-- MONJEZ V2 — P07: Collaboration (task_comments: replies, mentions, edit,
-- attachments, notifications, realtime).
-- Run after schema.sql, rls.sql, dashboard_extras.sql.
--
-- task_comments was flat (content + author only): no threading, no edit,
-- no mentions, no attachments. This extends the SAME table/feature instead
-- of a parallel system, reusing the existing task-attachments Storage
-- bucket and the existing notifications table (adding one nullable column
-- for deep-linking, same as meeting_id/article_id were added in prior
-- phases).
--
-- Important pre-existing gap this also has to work around: users_select
-- (google_signup.sql) only lets a plain employee see THEIR OWN row - a
-- comment's author name join (author:users!task_comments_user_id_fkey)
-- silently returns null for anyone viewing a comment written by someone
-- else's role they can't otherwise see (manager commenting on an
-- employee's own task, for example) - the exact class of bug already fixed
-- for meeting organizer/attendee names via meeting_detail_extra() in
-- meeting_fixes.sql. task_comments_with_authors() below applies the same
-- fix: SECURITY DEFINER, re-validates the caller can see the task using
-- tasks_select's own condition, then bypasses RLS to resolve names.

alter table public.task_comments
  add column parent_comment_id uuid references public.task_comments(id) on delete cascade,
  add column updated_at timestamptz not null default now();

create trigger task_comments_set_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

create policy task_comments_update on public.task_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notifications add column comment_id uuid references public.task_comments(id) on delete cascade;

-- ============================================================
-- mentions
-- ============================================================
create table public.task_comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.task_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

alter table public.task_comment_mentions enable row level security;

create policy task_comment_mentions_select on public.task_comment_mentions
  for select using (exists (select 1 from public.task_comments c where c.id = comment_id));

create policy task_comment_mentions_insert on public.task_comment_mentions
  for insert with check (
    exists (select 1 from public.task_comments c where c.id = comment_id and c.user_id = auth.uid())
  );

-- ============================================================
-- attachments on a comment - reuses the task-attachments bucket, path
-- "comments/<comment_id>/<file>", mirroring task_attachments' own shape
-- ============================================================
create table public.task_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.task_comments(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

alter table public.task_comment_attachments enable row level security;

create policy task_comment_attachments_select on public.task_comment_attachments
  for select using (exists (select 1 from public.task_comments c where c.id = comment_id));

create policy task_comment_attachments_insert on public.task_comment_attachments
  for insert with check (
    exists (select 1 from public.task_comments c where c.id = comment_id) and uploaded_by = auth.uid()
  );

create policy task_comment_attachments_delete on public.task_comment_attachments
  for delete using (uploaded_by = auth.uid() or public.current_user_role() = 'super_admin');

create policy comment_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and exists (
      select 1 from public.task_comments c where c.id = (storage.foldername(name))[2]::uuid
    )
  );

create policy comment_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and owner = auth.uid()
    and exists (
      select 1 from public.task_comments c where c.id = (storage.foldername(name))[2]::uuid
    )
  );

create policy comment_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );

-- ============================================================
-- notifications: reply + mention
-- ============================================================
create function public.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_author uuid;
  task_title text;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select user_id into parent_author from public.task_comments where id = new.parent_comment_id;
  if parent_author is null or parent_author = new.user_id then
    return new;
  end if;

  select title into task_title from public.tasks where id = new.task_id;
  insert into public.notifications (user_id, task_id, comment_id, type, message)
  values (parent_author, new.task_id, new.id, 'comment_reply', 'رد جديد على تعليقك في: ' || coalesce(task_title, ''));

  return new;
end;
$$;

create trigger task_comments_notify_reply
  after insert on public.task_comments
  for each row execute function public.notify_comment_reply();

create function public.notify_comment_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  commenter uuid;
  task_id_val uuid;
  task_title text;
begin
  select user_id, task_id into commenter, task_id_val from public.task_comments where id = new.comment_id;
  if commenter is null or new.mentioned_user_id = commenter then
    return new;
  end if;

  select title into task_title from public.tasks where id = task_id_val;
  insert into public.notifications (user_id, task_id, comment_id, type, message)
  values (new.mentioned_user_id, task_id_val, new.comment_id, 'comment_mention', 'تمت الإشارة إليك في تعليق على: ' || coalesce(task_title, ''));

  return new;
end;
$$;

create trigger task_comment_mentions_notify
  after insert on public.task_comment_mentions
  for each row execute function public.notify_comment_mention();

alter publication supabase_realtime add table public.task_comments;

-- ============================================================
-- task_comments_with_authors: works around users_select's own-row-only
-- restriction for a plain employee, same pattern as meeting_detail_extra()
-- ============================================================
create or replace function public.task_comments_with_authors(p_task_id uuid)
returns table (
  id uuid,
  parent_comment_id uuid,
  user_id uuid,
  author_name text,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  is_edited boolean,
  mentioned_names text[],
  attachments jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.organization_id = public.current_org_id()
      and (
        public.current_user_role() = 'super_admin'
        or (public.current_user_role() = 'department_manager' and t.assigned_to in (
          select id from public.users where department_id = public.current_department_id()
        ))
        or t.assigned_to = auth.uid()
      )
  ) then
    return;
  end if;

  return query
    select
      c.id,
      c.parent_comment_id,
      c.user_id,
      coalesce(u.full_name, 'مستخدم محذوف'),
      c.content,
      c.created_at,
      c.updated_at,
      c.updated_at > c.created_at,
      (
        select coalesce(array_agg(mu.full_name order by mu.full_name), array[]::text[])
        from public.task_comment_mentions m
        join public.users mu on mu.id = m.mentioned_user_id
        where m.comment_id = c.id
      ),
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'file_name', a.file_name, 'file_url', a.file_url, 'file_type', a.file_type
        ) order by a.uploaded_at), '[]'::jsonb)
        from public.task_comment_attachments a
        where a.comment_id = c.id
      )
    from public.task_comments c
    left join public.users u on u.id = c.user_id
    where c.task_id = p_task_id
    order by c.created_at asc;
end;
$$;

-- ============================================================
-- task_mentionable_users: assignee + creator + everyone who already
-- commented, for the @mention picker - same visibility guard as above
-- ============================================================
create or replace function public.task_mentionable_users(p_task_id uuid)
returns table (id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.organization_id = public.current_org_id()
      and (
        public.current_user_role() = 'super_admin'
        or (public.current_user_role() = 'department_manager' and t.assigned_to in (
          select id from public.users where department_id = public.current_department_id()
        ))
        or t.assigned_to = auth.uid()
      )
  ) then
    return;
  end if;

  return query
    select distinct u.id, u.full_name
    from public.users u
    where u.id in (
      select assigned_to from public.tasks where id = p_task_id
      union
      select created_by from public.tasks where id = p_task_id
      union
      select user_id from public.task_comments where task_id = p_task_id
    )
    and u.id != auth.uid()
    order by u.full_name;
end;
$$;
