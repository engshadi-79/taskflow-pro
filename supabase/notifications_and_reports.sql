-- TaskFlow Pro — Phase 5: notifications, scheduled reminders, reports
-- Run this after schema.sql, rls.sql, storage.sql, and (optionally) seed.sql.

-- ============================================================
-- enable Realtime on notifications so the in-app bell updates live
-- ============================================================
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- event-driven notifications: assignment + status changes
-- SECURITY DEFINER because the notifications table has no INSERT
-- policy for regular users (see rls.sql) — only this trigger may
-- create notification rows.
-- ============================================================
create function public.notify_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, task_id, type, message)
    values (new.assigned_to, new.id, 'task_assigned', 'تم إسناد مهمة جديدة إليك: ' || new.title);
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.notifications (user_id, task_id, type, message)
      values (new.assigned_to, new.id, 'task_assigned', 'تم إسناد مهمة إليك: ' || new.title);
    end if;

    if new.status is distinct from old.status then
      if new.status = 'pending_review' and new.created_by is not null then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.created_by, new.id, 'task_pending_review', 'مهمة بانتظار مراجعتك: ' || new.title);
      elsif new.status = 'completed' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_completed', 'تم اعتماد مهمتك: ' || new.title);
      elsif new.status = 'in_progress' and old.status = 'pending_review' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_rejected', 'تم رفض مهمتك، راجع الملاحظات: ' || new.title);
      elsif new.status = 'overdue' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_overdue', 'المهمة متأخرة: ' || new.title);
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger tasks_notify_events
  after insert or update on public.tasks
  for each row execute function public.notify_task_event();

-- ============================================================
-- scheduled reminders + overdue marking
-- (a task with no due_time is treated as due by end of day)
-- ============================================================
create function public.send_due_date_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reminder_window record;
begin
  for reminder_window in
    select * from (values
      ('reminder_1week', interval '7 days'),
      ('reminder_3days', interval '3 days'),
      ('reminder_1day', interval '1 day'),
      ('reminder_2hours', interval '2 hours'),
      ('reminder_30min', interval '30 minutes')
    ) as w(reminder_type, lead_time)
  loop
    insert into public.notifications (user_id, task_id, type, message)
    select
      t.assigned_to,
      t.id,
      reminder_window.reminder_type,
      'تذكير: يستحق موعد المهمة "' || t.title || '" قريبًا'
    from public.tasks t
    where t.due_date is not null
      and t.status not in ('completed', 'cancelled')
      and (t.due_date + coalesce(t.due_time, '23:59:59'::time)) <= now() + reminder_window.lead_time
      and (t.due_date + coalesce(t.due_time, '23:59:59'::time)) > now()
      and not exists (
        select 1 from public.notifications n
        where n.task_id = t.id and n.type = reminder_window.reminder_type
      );
  end loop;
end;
$$;

create function public.mark_overdue_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set status = 'overdue'
  where status in ('new', 'in_progress', 'pending_review')
    and due_date is not null
    and (due_date + coalesce(due_time, '23:59:59'::time)) < now();
end;
$$;

-- Runs pg_cron every 15 minutes. If this errors with a permissions
-- message, enable the pg_cron extension from the Supabase dashboard
-- (Database -> Extensions) and re-run just the two `select
-- cron.schedule(...)` statements below.
create extension if not exists pg_cron;

select cron.schedule(
  'send-due-date-reminders',
  '*/15 * * * *',
  $$select public.send_due_date_reminders()$$
);

select cron.schedule(
  'mark-overdue-tasks',
  '*/15 * * * *',
  $$select public.mark_overdue_tasks()$$
);

-- ============================================================
-- reports (SECURITY INVOKER: RLS on tasks/users/departments scopes
-- results to the caller automatically — org-wide for super_admin,
-- department-only for department_manager)
-- ============================================================
create function public.report_top_employees()
returns table (user_id uuid, full_name text, completed_count bigint)
language sql
security invoker
stable
as $$
  select u.id, u.full_name, count(t.id) as completed_count
  from public.users u
  join public.tasks t on t.assigned_to = u.id and t.status = 'completed'
  group by u.id, u.full_name
  order by completed_count desc
  limit 5;
$$;

create function public.report_top_departments()
returns table (department_id uuid, department_name text, completed_count bigint)
language sql
security invoker
stable
as $$
  select d.id, d.name, count(t.id) as completed_count
  from public.departments d
  join public.users u on u.department_id = d.id
  join public.tasks t on t.assigned_to = u.id and t.status = 'completed'
  group by d.id, d.name
  order by completed_count desc
  limit 5;
$$;

create function public.report_avg_completion_hours()
returns numeric
language sql
security invoker
stable
as $$
  select round(avg(extract(epoch from (updated_at - created_at)) / 3600.0), 1)
  from public.tasks
  where status = 'completed';
$$;

create function public.report_delay_rate()
returns numeric
language sql
security invoker
stable
as $$
  select case when count(*) = 0 then 0 else
    round(
      100.0 * count(*) filter (
        where status = 'overdue'
        or (status = 'completed' and due_date is not null and updated_at > (due_date + coalesce(due_time, '23:59:59'::time)))
      ) / count(*),
      1
    )
  end
  from public.tasks
  where status != 'cancelled';
$$;
