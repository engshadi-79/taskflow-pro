-- Admin broadcast announcements ("الإشعارات الإدارية").
-- Run after schema.sql, rls.sql.
--
-- admin_notifications is the campaign record (title/message/type/priority/
-- target). Delivery + read state per recipient is NOT a separate table -
-- it reuses the existing `notifications` table (adding title/read_at/
-- admin_notification_id columns to it), the same table every other
-- notification type in this app already uses. NotificationBell and
-- /dashboard/notifications need zero changes to show these; they're just
-- notifications rows like any other.
--
-- Targeting rule (per explicit decision): department_manager can only
-- target their OWN department (specific members of it, or the whole
-- department) - never "all" org-wide. super_admin is unrestricted within
-- their own organization. All of this is enforced inside
-- send_admin_notification() itself, not by a client-side check, since a
-- direct REST call must be rejected the same way the UI never lets you
-- try.

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'general' check (
    type in ('general', 'reminder', 'announcement', 'warning', 'urgent', 'meeting', 'system')
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  target_type text not null check (target_type in ('specific', 'department', 'all')),
  target_department_id uuid references public.departments(id) on delete set null,
  recipient_count int not null default 0,
  status text not null default 'sent' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index admin_notifications_org_idx on public.admin_notifications(organization_id, created_at desc);

alter table public.admin_notifications enable row level security;

create policy admin_notifications_select on public.admin_notifications
  for select using (
    organization_id = public.current_org_id()
    and (sender_id = auth.uid() or public.current_user_role() = 'super_admin')
  );

-- no INSERT policy on purpose: send_admin_notification() is the only path,
-- so the department_manager targeting restriction above can never be
-- bypassed by a direct REST insert.

alter table public.notifications
  add column title text,
  add column read_at timestamptz,
  add column admin_notification_id uuid references public.admin_notifications(id) on delete cascade;

create index notifications_admin_notification_id_idx
  on public.notifications(admin_notification_id)
  where admin_notification_id is not null;

create or replace function public.send_admin_notification(
  p_title text,
  p_message text,
  p_type text,
  p_priority text,
  p_target_type text,
  p_department_id uuid,
  p_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := current_user_role();
  caller_org uuid := current_org_id();
  caller_dept uuid;
  new_id uuid;
  recipient_ids uuid[];
begin
  if caller_role not in ('super_admin', 'department_manager') then
    raise exception 'غير مصرح لك بإرسال إشعارات إدارية';
  end if;

  select department_id into caller_dept from public.users where id = auth.uid();

  if p_target_type = 'all' then
    if caller_role = 'department_manager' then
      raise exception 'مدير القسم يستطيع الإرسال لقسمه فقط';
    end if;
    select array_agg(id) into recipient_ids
      from public.users where organization_id = caller_org and is_active;
  elsif p_target_type = 'department' then
    if caller_role = 'department_manager' and p_department_id is distinct from caller_dept then
      raise exception 'مدير القسم يستطيع الإرسال لقسمه فقط';
    end if;
    select array_agg(id) into recipient_ids
      from public.users
      where department_id = p_department_id and organization_id = caller_org and is_active;
  elsif p_target_type = 'specific' then
    if caller_role = 'department_manager' then
      if exists (
        select 1 from public.users u
        where u.id = any(p_user_ids)
          and (u.department_id is distinct from caller_dept or u.organization_id != caller_org)
      ) then
        raise exception 'يمكنك استهداف موظفي قسمك فقط';
      end if;
    else
      if exists (select 1 from public.users u where u.id = any(p_user_ids) and u.organization_id != caller_org) then
        raise exception 'مستلم غير صالح';
      end if;
    end if;
    recipient_ids := p_user_ids;
  else
    raise exception 'نوع استهداف غير صالح';
  end if;

  if recipient_ids is null or array_length(recipient_ids, 1) is null then
    raise exception 'لا يوجد مستلمون مطابقون';
  end if;

  insert into public.admin_notifications (
    organization_id, sender_id, title, message, type, priority,
    target_type, target_department_id, recipient_count, status, sent_at
  )
  values (
    caller_org, auth.uid(), p_title, p_message, p_type, p_priority,
    p_target_type, p_department_id, array_length(recipient_ids, 1), 'sent', now()
  )
  returning id into new_id;

  insert into public.notifications (user_id, type, title, message, admin_notification_id)
  select uid, 'admin_announcement', p_title, p_message, new_id
  from unnest(recipient_ids) as uid;

  return new_id;
end;
$$;

revoke all on function public.send_admin_notification(text, text, text, text, text, uuid, uuid[]) from public;
grant execute on function public.send_admin_notification(text, text, text, text, text, uuid, uuid[]) to authenticated;

-- SECURITY DEFINER (not invoker): notifications_select restricts a caller
-- to their OWN rows (user_id = auth.uid()), so an admin querying stats for
-- notifications sent TO OTHER people would see zero rows under invoker
-- context - exactly the RLS-blocks-embedded-query class of bug already
-- hit for meeting organizer names and comment author names. This
-- re-checks visibility manually instead.
create or replace function public.admin_notification_stats(p_notification_id uuid)
returns table (recipient_count bigint, read_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_notifications a
    where a.id = p_notification_id
      and (a.sender_id = auth.uid() or public.current_user_role() = 'super_admin')
  ) then
    return;
  end if;

  return query
    select count(*), count(*) filter (where n.is_read)
    from public.notifications n
    where n.admin_notification_id = p_notification_id;
end;
$$;

create or replace function public.admin_notification_recipients(p_notification_id uuid)
returns table (user_id uuid, full_name text, is_read boolean, read_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_notifications a
    where a.id = p_notification_id
      and (a.sender_id = auth.uid() or public.current_user_role() = 'super_admin')
  ) then
    return;
  end if;

  return query
    select u.id, u.full_name, n.is_read, n.read_at
    from public.notifications n
    join public.users u on u.id = n.user_id
    where n.admin_notification_id = p_notification_id
    order by n.is_read asc, u.full_name;
end;
$$;
