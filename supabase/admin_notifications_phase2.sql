-- Admin broadcast announcements — Phase 2: scheduling, recurrence, templates.
-- Run after admin_notifications.sql (and recurring_tasks.sql, for precedent
-- only — no hard dependency, next_recurrence_timestamp below is a
-- standalone timestamptz sibling of that file's next_recurrence_date).
--
-- Design: admin_notifications now resolves and FREEZES the recipient list
-- at creation time (resolved_recipient_ids), instead of resolving it at
-- send time. This is what lets scheduled/recurring delivery run later from
-- pg_cron with no auth.uid() context — the permission + department-scoping
-- check already happened when the sender created the campaign, so delivery
-- itself doesn't need to re-check anything.
--
-- Recurring series are a separate table (admin_notification_series)
-- because a recurring campaign has no fixed recipient list: each occurrence
-- re-resolves "my department" / "all employees" against who's actually
-- active in that department at THAT time. Only a "specific employees" list
-- is frozen across occurrences (target_user_ids on the series row).

-- ============================================================
-- admin_notifications: add scheduling/recurrence-link columns
-- ============================================================

alter table public.admin_notifications
  add column scheduled_at timestamptz,
  add column resolved_recipient_ids uuid[],
  add column series_id uuid,
  add column cancelled_at timestamptz;

alter table public.admin_notifications drop constraint admin_notifications_status_check;
alter table public.admin_notifications
  add constraint admin_notifications_status_check
  check (status in ('draft', 'scheduled', 'sent', 'cancelled'));

create index admin_notifications_scheduled_idx
  on public.admin_notifications(scheduled_at)
  where status = 'scheduled';

-- ============================================================
-- shared recipient-resolution helper (extracted from
-- send_admin_notification so schedule/series creation enforce the exact
-- same department_manager-own-department-only rule, in one place)
-- ============================================================

create or replace function public._resolve_admin_notification_recipients(
  p_caller_role text,
  p_caller_org uuid,
  p_caller_dept uuid,
  p_target_type text,
  p_department_id uuid,
  p_user_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_ids uuid[];
begin
  if p_caller_role not in ('super_admin', 'department_manager') then
    raise exception 'غير مصرح لك بإرسال إشعارات إدارية';
  end if;

  if p_target_type = 'all' then
    if p_caller_role = 'department_manager' then
      raise exception 'مدير القسم يستطيع الإرسال لقسمه فقط';
    end if;
    select array_agg(id) into recipient_ids
      from public.users where organization_id = p_caller_org and is_active;
  elsif p_target_type = 'department' then
    if p_caller_role = 'department_manager' and p_department_id is distinct from p_caller_dept then
      raise exception 'مدير القسم يستطيع الإرسال لقسمه فقط';
    end if;
    select array_agg(id) into recipient_ids
      from public.users
      where department_id = p_department_id and organization_id = p_caller_org and is_active;
  elsif p_target_type = 'specific' then
    if p_caller_role = 'department_manager' then
      if exists (
        select 1 from public.users u
        where u.id = any(p_user_ids)
          and (u.department_id is distinct from p_caller_dept or u.organization_id != p_caller_org)
      ) then
        raise exception 'يمكنك استهداف موظفي قسمك فقط';
      end if;
    else
      if exists (select 1 from public.users u where u.id = any(p_user_ids) and u.organization_id != p_caller_org) then
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

  return recipient_ids;
end;
$$;

-- send_admin_notification now delegates to the shared helper and stores
-- the resolved list (previously it resolved and delivered inline, and
-- nothing needed to be remembered after the fact)
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
  select department_id into caller_dept from public.users where id = auth.uid();

  recipient_ids := public._resolve_admin_notification_recipients(
    caller_role, caller_org, caller_dept, p_target_type, p_department_id, p_user_ids
  );

  insert into public.admin_notifications (
    organization_id, sender_id, title, message, type, priority,
    target_type, target_department_id, recipient_count, status, sent_at,
    resolved_recipient_ids
  )
  values (
    caller_org, auth.uid(), p_title, p_message, p_type, p_priority,
    p_target_type, p_department_id, array_length(recipient_ids, 1), 'sent', now(),
    recipient_ids
  )
  returning id into new_id;

  insert into public.notifications (user_id, type, title, message, admin_notification_id)
  select uid, 'admin_announcement', p_title, p_message, new_id
  from unnest(recipient_ids) as uid;

  return new_id;
end;
$$;

-- ============================================================
-- scheduling: create now, deliver later
-- ============================================================

create or replace function public.schedule_admin_notification(
  p_title text,
  p_message text,
  p_type text,
  p_priority text,
  p_target_type text,
  p_department_id uuid,
  p_user_ids uuid[],
  p_scheduled_at timestamptz
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
  if p_scheduled_at <= now() then
    raise exception 'وقت الجدولة يجب أن يكون في المستقبل';
  end if;

  select department_id into caller_dept from public.users where id = auth.uid();

  recipient_ids := public._resolve_admin_notification_recipients(
    caller_role, caller_org, caller_dept, p_target_type, p_department_id, p_user_ids
  );

  insert into public.admin_notifications (
    organization_id, sender_id, title, message, type, priority,
    target_type, target_department_id, recipient_count, status, scheduled_at,
    resolved_recipient_ids
  )
  values (
    caller_org, auth.uid(), p_title, p_message, p_type, p_priority,
    p_target_type, p_department_id, array_length(recipient_ids, 1), 'scheduled', p_scheduled_at,
    recipient_ids
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- unattended delivery step: no auth.uid() context (called from pg_cron),
-- which is fine because the permission/scoping check already happened at
-- schedule_admin_notification() time and its result is frozen in
-- resolved_recipient_ids
create or replace function public.deliver_admin_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n record;
begin
  select * into n from public.admin_notifications
    where id = p_notification_id and status = 'scheduled'
    for update skip locked;

  if not found then
    return;
  end if;

  insert into public.notifications (user_id, type, title, message, admin_notification_id)
  select uid, 'admin_announcement', n.title, n.message, n.id
  from unnest(n.resolved_recipient_ids) as uid;

  update public.admin_notifications set status = 'sent', sent_at = now() where id = n.id;
end;
$$;

create or replace function public.process_scheduled_admin_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n_id uuid;
begin
  for n_id in
    select id from public.admin_notifications
    where status = 'scheduled' and scheduled_at <= now()
  loop
    perform public.deliver_admin_notification(n_id);
  end loop;
end;
$$;

create or replace function public.cancel_scheduled_admin_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_notifications
  set status = 'cancelled', cancelled_at = now()
  where id = p_notification_id
    and status = 'scheduled'
    and (sender_id = auth.uid() or public.current_user_role() = 'super_admin');

  if not found then
    raise exception 'لا يمكن إلغاء هذا الإشعار';
  end if;
end;
$$;

revoke all on function public.schedule_admin_notification(text, text, text, text, text, uuid, uuid[], timestamptz) from public;
grant execute on function public.schedule_admin_notification(text, text, text, text, text, uuid, uuid[], timestamptz) to authenticated;
revoke all on function public.cancel_scheduled_admin_notification(uuid) from public;
grant execute on function public.cancel_scheduled_admin_notification(uuid) to authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'process-scheduled-admin-notifications',
  '*/5 * * * *',
  $$select public.process_scheduled_admin_notifications()$$
);

-- ============================================================
-- recurrence: admin_notification_series is the standing rule; every
-- occurrence it produces is an ordinary admin_notifications row (series_id
-- pointing back at it), so the list/detail pages need no special case
-- ============================================================

create table public.admin_notification_series (
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
  target_user_ids uuid[],
  recurrence_pattern text not null check (recurrence_pattern in ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval int not null default 1 check (recurrence_interval > 0),
  recurrence_days_of_week int[] check (
    recurrence_days_of_week is null or recurrence_days_of_week <@ array[0,1,2,3,4,5,6]
  ),
  end_date date,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_notifications
  add constraint admin_notifications_series_id_fkey
  foreign key (series_id) references public.admin_notification_series(id) on delete set null;

create index admin_notification_series_due_idx
  on public.admin_notification_series(next_run_at)
  where is_active;

alter table public.admin_notification_series enable row level security;

create policy admin_notification_series_select on public.admin_notification_series
  for select using (
    organization_id = public.current_org_id()
    and (sender_id = auth.uid() or public.current_user_role() = 'super_admin')
  );

-- no INSERT/UPDATE policy on purpose, same reasoning as admin_notifications:
-- create/cancel go through functions below so the department_manager
-- own-department-only rule can't be bypassed by a direct REST call

-- timestamptz sibling of recurring_tasks.sql's next_recurrence_date - same
-- pattern/interval/days_of_week semantics, but keeps the time-of-day the
-- sender picked (a `date` has none) since it adds intervals directly to a
-- timestamptz instead of a date
create or replace function public.next_recurrence_timestamp(
  p_from timestamptz,
  p_pattern text,
  p_interval int,
  p_days_of_week int[]
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  candidate timestamptz;
  guard int := 0;
begin
  if p_pattern = 'daily' then
    return p_from + (p_interval || ' days')::interval;
  end if;

  if p_pattern = 'monthly' then
    return p_from + (p_interval || ' months')::interval;
  end if;

  if p_pattern = 'yearly' then
    return p_from + (p_interval || ' years')::interval;
  end if;

  -- weekly, with or without specific weekdays
  if p_days_of_week is null or array_length(p_days_of_week, 1) is null then
    return p_from + (p_interval || ' weeks')::interval;
  end if;

  candidate := p_from + interval '1 day';
  while guard < (p_interval * 7 + 7) loop
    if extract(dow from candidate)::int = any(p_days_of_week) then
      return candidate;
    end if;
    candidate := candidate + interval '1 day';
    guard := guard + 1;
  end loop;

  -- unreachable given the guard bound, but never return null
  return p_from + (p_interval || ' weeks')::interval;
end;
$$;

create or replace function public.create_admin_notification_series(
  p_title text,
  p_message text,
  p_type text,
  p_priority text,
  p_target_type text,
  p_department_id uuid,
  p_user_ids uuid[],
  p_pattern text,
  p_interval int,
  p_days_of_week int[],
  p_end_date date,
  p_first_run_at timestamptz
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
begin
  if p_first_run_at <= now() then
    raise exception 'وقت أول إرسال يجب أن يكون في المستقبل';
  end if;

  select department_id into caller_dept from public.users where id = auth.uid();

  -- validate permissions/scoping now so a bad series is rejected at
  -- creation, not silently skipped on its first scheduled run; the
  -- resolved list itself is discarded - each occurrence re-resolves against
  -- who's active at that time (see process_recurring_admin_notification_series)
  perform public._resolve_admin_notification_recipients(
    caller_role, caller_org, caller_dept, p_target_type, p_department_id, p_user_ids
  );

  insert into public.admin_notification_series (
    organization_id, sender_id, title, message, type, priority,
    target_type, target_department_id, target_user_ids,
    recurrence_pattern, recurrence_interval, recurrence_days_of_week, end_date, next_run_at
  )
  values (
    caller_org, auth.uid(), p_title, p_message, p_type, p_priority,
    p_target_type, p_department_id, p_user_ids,
    p_pattern, p_interval, p_days_of_week, p_end_date, p_first_run_at
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.cancel_admin_notification_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_notification_series
  set is_active = false
  where id = p_series_id
    and (sender_id = auth.uid() or public.current_user_role() = 'super_admin');

  if not found then
    raise exception 'لا يمكن إلغاء هذا الإشعار المتكرر';
  end if;
end;
$$;

-- unattended (pg_cron, no auth.uid()): re-resolves recipients against the
-- sender's CURRENT role/department each occurrence, not what was true when
-- the series was created - a department_manager who changed departments,
-- or one whose department gained/lost staff, gets today's reality
create or replace function public.process_recurring_admin_notification_series()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_role text;
  v_dept uuid;
  recipient_ids uuid[];
  new_id uuid;
  next_run timestamptz;
begin
  for s in
    select * from public.admin_notification_series
    where is_active and next_run_at <= now()
    for update skip locked
  loop
    begin
      select role, department_id into v_role, v_dept from public.users where id = s.sender_id;

      if v_role is null then
        update public.admin_notification_series set is_active = false where id = s.id;
        continue;
      end if;

      recipient_ids := public._resolve_admin_notification_recipients(
        v_role, s.organization_id, v_dept, s.target_type, s.target_department_id, s.target_user_ids
      );

      insert into public.admin_notifications (
        organization_id, sender_id, title, message, type, priority,
        target_type, target_department_id, recipient_count, status, sent_at,
        resolved_recipient_ids, series_id
      )
      values (
        s.organization_id, s.sender_id, s.title, s.message, s.type, s.priority,
        s.target_type, s.target_department_id, array_length(recipient_ids, 1), 'sent', now(),
        recipient_ids, s.id
      )
      returning id into new_id;

      insert into public.notifications (user_id, type, title, message, admin_notification_id)
      select uid, 'admin_announcement', s.title, s.message, new_id
      from unnest(recipient_ids) as uid;
    exception when others then
      -- a bad occurrence (e.g. sender no longer has anyone to notify) must
      -- not stop the whole cron batch, but must not spin forever either
      update public.admin_notification_series set is_active = false where id = s.id;
      continue;
    end;

    next_run := public.next_recurrence_timestamp(s.next_run_at, s.recurrence_pattern, s.recurrence_interval, s.recurrence_days_of_week);

    if s.end_date is not null and next_run::date > s.end_date then
      update public.admin_notification_series
      set is_active = false, last_run_at = now()
      where id = s.id;
    else
      update public.admin_notification_series
      set next_run_at = next_run, last_run_at = now()
      where id = s.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.create_admin_notification_series(text, text, text, text, text, uuid, uuid[], text, int, int[], date, timestamptz) from public;
grant execute on function public.create_admin_notification_series(text, text, text, text, text, uuid, uuid[], text, int, int[], date, timestamptz) to authenticated;
revoke all on function public.cancel_admin_notification_series(uuid) from public;
grant execute on function public.cancel_admin_notification_series(uuid) to authenticated;

select cron.schedule(
  'process-recurring-admin-notification-series',
  '*/15 * * * *',
  $$select public.process_recurring_admin_notification_series()$$
);

-- ============================================================
-- templates: plain shared library, no privilege-sensitive targeting logic
-- involved (a template is just prefill text), so direct RLS is enough -
-- unlike admin_notifications/admin_notification_series there's no need to
-- route creation through a SECURITY DEFINER function
-- ============================================================

create table public.admin_notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null,
  title text not null,
  message text not null,
  type text not null default 'general' check (
    type in ('general', 'reminder', 'announcement', 'warning', 'urgent', 'meeting', 'system')
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now()
);

create index admin_notification_templates_org_idx on public.admin_notification_templates(organization_id, created_at desc);

alter table public.admin_notification_templates enable row level security;

-- shared library: any sender in the org can see and use every template,
-- not just their own - only editing/deleting is restricted to the creator
create policy admin_notification_templates_select on public.admin_notification_templates
  for select using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
  );

create policy admin_notification_templates_insert on public.admin_notification_templates
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
    and created_by = auth.uid()
  );

create policy admin_notification_templates_update on public.admin_notification_templates
  for update using (
    created_by = auth.uid() or public.current_user_role() = 'super_admin'
  );

create policy admin_notification_templates_delete on public.admin_notification_templates
  for delete using (
    created_by = auth.uid() or public.current_user_role() = 'super_admin'
  );
