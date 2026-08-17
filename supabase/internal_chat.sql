-- MONJEZ — Internal Chat (1-to-1 + group conversations, Messenger-style)
-- A new feature outside the 20-phase MONJEZ 3.0 plan, requested directly by
-- the user. Genuinely greenfield: no messaging/conversation table existed
-- anywhere before this file (task_comments are tied to a task, not a
-- standalone person-to-person thread).
--
-- Reused from existing conventions rather than reinvented:
--   - "no INSERT policy, route through a SECURITY DEFINER function" for
--     conversation creation (same shape as role_permissions, workflow
--     templates, etc.)
--   - "resolve RLS-hidden user names via a SECURITY DEFINER RPC that first
--     re-validates the caller's own visibility" - the exact pattern
--     task_comments_with_authors()/meeting_detail_extra() already use,
--     needed here because a plain employee's users_select RLS only lets
--     them see their OWN row, never a co-worker's, so every other
--     participant's name/avatar must be resolved server-side.
--   - attachments reuse the existing private 'task-attachments' bucket
--     under a new "chat/<conversation_id>/..." prefix, same convention as
--     "knowledge/<id>/..." and "meetings/<id>/..." (storage_knowledge_meetings.sql).

-- ============================================================
-- Schema
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('direct', 'group')),
  name text, -- group display name only; a direct conversation's "name" is always the other participant, resolved at query time
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now() -- bumped on every new message, drives conversation-list ordering
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz -- soft delete: the row stays (so "تم حذف هذه الرسالة" can render in place), content is cleared
);

create table public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

create index conversations_organization_id_idx on public.conversations(organization_id);
create index conversation_participants_conversation_id_idx on public.conversation_participants(conversation_id);
create index conversation_participants_user_id_idx on public.conversation_participants(user_id);
create index chat_messages_conversation_id_idx on public.chat_messages(conversation_id, created_at desc);
create index chat_message_attachments_message_id_idx on public.chat_message_attachments(message_id);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_attachments enable row level security;

-- ============================================================
-- is_conversation_participant: every policy below that needs to check
-- "is auth.uid() a member of this conversation" calls this instead of
-- nested-querying conversation_participants directly. A plain nested
-- `exists (select 1 from conversation_participants where ...)` inside
-- conversation_participants' OWN select policy is a self-referencing RLS
-- policy - Postgres re-applies that same policy to the nested query,
-- which nested-queries the table again, forever ("infinite recursion
-- detected in policy for relation conversation_participants"). The same
-- problem hits any OTHER table's policy that nested-queries
-- conversation_participants too, since evaluating that nested query still
-- triggers conversation_participants' own (recursive) policy.
--
-- A SECURITY DEFINER function breaks the cycle: it executes as its owner
-- (the migration role, which owns these tables), and table owners are not
-- subject to their own table's RLS unless FORCE ROW LEVEL SECURITY is set
-- (it isn't here) - so its internal query bypasses RLS entirely instead
-- of re-triggering it. Same reasoning as current_org_id()/
-- current_user_role() (rls.sql) being SECURITY DEFINER rather than plain
-- views.
-- ============================================================

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================

create policy conversations_select on public.conversations
  for select using (public.is_conversation_participant(id));
-- no insert/update policy - creation goes through create_conversation()
-- below (SECURITY DEFINER); renaming a group goes through rename_conversation().

create policy conversation_participants_select on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

-- Marking your own participant row as read is the one plain self-service
-- write on this table - same "own row, no cross-user dimension" reasoning
-- as organization_holidays/plan_upgrade_requests, no function needed.
create policy conversation_participants_update_own on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_messages_select on public.chat_messages
  for select using (public.is_conversation_participant(conversation_id));

create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  );

-- Edit/soft-delete your own messages only - no time window, matching
-- task_comments' own author-only, no-window precedent.
create policy chat_messages_update on public.chat_messages
  for update using (sender_id = auth.uid());

create policy chat_message_attachments_select on public.chat_message_attachments
  for select using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy chat_message_attachments_insert on public.chat_message_attachments
  for insert with check (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id and m.sender_id = auth.uid() and public.is_conversation_participant(m.conversation_id)
    )
  );

-- ============================================================
-- Storage RLS: chat/<conversation_id>/<uuid>-<filename> inside the
-- existing private 'task-attachments' bucket. Scoped correctly to
-- conversation membership (tighter than the knowledge/meetings storage
-- policies, which only check "does the parent row exist" - chat privacy
-- specifically needs the participant check, not just row-existence).
-- ============================================================

create policy chat_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and public.is_conversation_participant((storage.foldername(name))[2]::uuid)
  );

create policy chat_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and owner = auth.uid()
    and public.is_conversation_participant((storage.foldername(name))[2]::uuid)
  );

create policy chat_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and owner = auth.uid()
  );

-- ============================================================
-- create_conversation: the only way a conversation is ever created.
-- 'direct' dedupes against an existing 1-to-1 thread between the same two
-- people instead of spawning a new one every time someone clicks
-- "message" on the same colleague.
-- ============================================================

create or replace function public.create_conversation(
  p_type text,
  p_name text,
  p_participant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_org uuid;
  new_id uuid;
  other_id uuid;
  existing_id uuid;
  loop_participant_id uuid;
  clean_name text := trim(coalesce(p_name, ''));
begin
  select organization_id into caller_org from public.users where id = caller_id;

  if p_type not in ('direct', 'group') then
    raise exception 'نوع محادثة غير صالح';
  end if;

  if array_length(p_participant_ids, 1) is null or array_length(p_participant_ids, 1) < 1 then
    raise exception 'اختر مشاركًا واحدًا على الأقل';
  end if;

  -- every participant must belong to the caller's own organization -
  -- re-checked here rather than trusted from the client. Aliased as
  -- "candidate_id", not "pid", to avoid colliding with the loop_participant_id
  -- plpgsql variable below (same name in both places would make
  -- plpgsql.variable_conflict raise "ambiguous column reference").
  if exists (
    select 1 from unnest(p_participant_ids) as candidate_id
    where not exists (
      select 1 from public.users u where u.id = candidate_id and u.organization_id = caller_org and u.is_active
    )
  ) then
    raise exception 'أحد المشاركين لا ينتمي إلى مؤسستك';
  end if;

  if p_type = 'direct' then
    if array_length(p_participant_ids, 1) <> 1 then
      raise exception 'محادثة فردية تحتاج مشاركًا واحدًا بالضبط';
    end if;
    other_id := p_participant_ids[1];
    if other_id = caller_id then
      raise exception 'لا يمكنك بدء محادثة مع نفسك';
    end if;

    select c.id into existing_id
    from public.conversations c
    where c.type = 'direct'
      and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = caller_id)
      and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = other_id)
      and (select count(*) from public.conversation_participants where conversation_id = c.id) = 2
    limit 1;

    if existing_id is not null then
      return existing_id;
    end if;

    insert into public.conversations (organization_id, type, name, created_by)
    values (caller_org, 'direct', null, caller_id)
    returning id into new_id;

    insert into public.conversation_participants (conversation_id, user_id) values (new_id, caller_id), (new_id, other_id);
  else
    if clean_name = '' then
      raise exception 'اسم المجموعة مطلوب';
    end if;

    insert into public.conversations (organization_id, type, name, created_by)
    values (caller_org, 'group', clean_name, caller_id)
    returning id into new_id;

    insert into public.conversation_participants (conversation_id, user_id) values (new_id, caller_id);
    for loop_participant_id in select distinct unnest(p_participant_ids) loop
      if loop_participant_id <> caller_id then
        insert into public.conversation_participants (conversation_id, user_id)
        values (new_id, loop_participant_id)
        on conflict (conversation_id, user_id) do nothing;
      end if;
    end loop;
  end if;

  return new_id;
end;
$$;

create or replace function public.rename_conversation(p_conversation_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := trim(coalesce(p_name, ''));
begin
  if clean_name = '' then
    raise exception 'الاسم مطلوب';
  end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'غير مصرح لك بتعديل هذه المحادثة';
  end if;

  -- deliberately not touching updated_at - renaming shouldn't reorder the
  -- list by "last activity" the way a new message does
  update public.conversations
  set name = clean_name
  where id = p_conversation_id and type = 'group';
end;
$$;

create or replace function public.add_conversation_participants(p_conversation_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid;
  pid uuid;
begin
  select organization_id into caller_org from public.users where id = auth.uid();

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'غير مصرح لك بتعديل هذه المحادثة';
  end if;

  if not exists (select 1 from public.conversations where id = p_conversation_id and type = 'group') then
    raise exception 'لا يمكن إضافة أعضاء إلا لمجموعة';
  end if;

  for pid in select distinct unnest(p_user_ids) loop
    if exists (select 1 from public.users where id = pid and organization_id = caller_org and is_active) then
      insert into public.conversation_participants (conversation_id, user_id)
      values (p_conversation_id, pid)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.leave_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = auth.uid();
end;
$$;

-- ============================================================
-- bump_conversation_on_message: keeps the conversation list ordered by
-- actual last activity. SECURITY DEFINER because updating a row in
-- `conversations` on a chat_messages insert needs to bypass RLS (there is
-- no client-facing UPDATE policy on conversations at all).
-- ============================================================

create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger chat_messages_bump_conversation
  after insert on public.chat_messages
  for each row execute function public.bump_conversation_on_message();

-- ============================================================
-- notify_chat_message: one notification per other participant per
-- message - same "no shared create_notification() choke point, every
-- producer does its own insert" shape as every other notification
-- producer in this project (all pass through apply_notification_preferences()
-- regardless). "Already viewing this conversation" suppression is handled
-- client-side (via the existing org-wide PresenceTracker's pathname
-- broadcast), not here - this always creates the row so it's in the
-- bell/list; only the OS toast may be skipped client-side.
-- ============================================================

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient uuid;
  preview text;
begin
  select full_name into sender_name from public.users where id = new.sender_id;
  preview := left(coalesce(new.content, 'أرسل مرفقًا'), 120);

  for recipient in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, conversation_id, type, title, message)
    values (recipient, new.conversation_id, 'chat_message', sender_name, preview);
  end loop;

  return new;
end;
$$;

alter table public.notifications add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

create trigger chat_messages_notify
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

-- ============================================================
-- Read RPCs: resolve names the caller's own users_select RLS would
-- otherwise hide (a plain employee can only see their own users row).
-- Every one re-validates the caller's own participation before returning
-- anything, exactly like task_comments_with_authors()/meeting_detail_extra().
-- ============================================================

create or replace function public.conversations_with_last_message()
returns table (
  conversation_id uuid,
  type text,
  name text,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select
    c.id,
    c.type,
    c.name,
    ou.id,
    ou.full_name,
    ou.avatar_url,
    lm.content,
    lm.created_at,
    (
      select count(*) from public.chat_messages m2
      where m2.conversation_id = c.id
        and m2.created_at > cp.last_read_at
        and m2.sender_id <> auth.uid()
        and m2.deleted_at is null
    )
  from public.conversations c
  join public.conversation_participants cp on cp.conversation_id = c.id and cp.user_id = auth.uid()
  left join lateral (
    select u2.id, u2.full_name, u2.avatar_url
    from public.conversation_participants cp2
    join public.users u2 on u2.id = cp2.user_id
    where cp2.conversation_id = c.id and cp2.user_id <> auth.uid() and c.type = 'direct'
    limit 1
  ) ou on true
  left join lateral (
    select content, created_at from public.chat_messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by created_at desc
    limit 1
  ) lm on true
  order by c.updated_at desc;
end;
$$;

create or replace function public.conversation_participants_with_profiles(p_conversation_id uuid)
returns table (user_id uuid, full_name text, avatar_url text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'غير مصرح لك بعرض هذه المحادثة';
  end if;

  return query
  select u.id, u.full_name, u.avatar_url
  from public.conversation_participants cp
  join public.users u on u.id = cp.user_id
  where cp.conversation_id = p_conversation_id
  order by u.full_name;
end;
$$;

create or replace function public.conversation_messages(
  p_conversation_id uuid,
  p_before timestamptz default null,
  p_limit int default 50
)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar text,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  attachments jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'غير مصرح لك بعرض هذه المحادثة';
  end if;

  return query
  select
    m.id, m.sender_id, u.full_name, u.avatar_url,
    m.content, m.created_at, m.updated_at, m.deleted_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', a.id, 'file_url', a.file_url, 'file_name', a.file_name, 'file_type', a.file_type))
       from public.chat_message_attachments a where a.message_id = m.id),
      '[]'::jsonb
    )
  from public.chat_messages m
  join public.users u on u.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit p_limit;
end;
$$;

-- Safe, minimal directory for "start a new conversation" pickers - name/
-- avatar/job title/department only, never email/phone/role. Any two
-- members of the same organization can message each other; there is no
-- existing "who can contact whom" restriction concept anywhere in this
-- project to mirror (confirmed: role_permissions has no such flag), so
-- this matches the codebase-wide default of unrestricted-by-department
-- collaboration (e.g. task_mentionable_users(), the command palette's
-- employee search).
create or replace function public.org_members_directory()
returns table (id uuid, full_name text, avatar_url text, job_title text, department_name text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.full_name, u.avatar_url, u.job_title, d.name
  from public.users u
  left join public.departments d on d.id = u.department_id
  where u.organization_id = public.current_org_id()
    and u.is_active = true
    and u.id <> auth.uid()
  order by u.full_name;
$$;

alter publication supabase_realtime add table public.chat_messages;
