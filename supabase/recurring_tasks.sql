-- MONJEZ V2 — P04: Recurring Tasks
-- Run after schema.sql, rls.sql, dashboard_extras.sql, task_status_workflow.sql.
--
-- is_recurring/recurrence_pattern already existed on tasks (schema.sql) but
-- were pure metadata - nothing ever generated a next occurrence. This adds
-- the missing generation columns + pg_cron job, reusing the same `tasks`
-- table and its existing RLS/notification/activity-log triggers rather than
-- a parallel "recurrence" system: every generated occurrence is a normal
-- task row, visible/writable under the exact same tasks_select/tasks_update
-- policies as any other task, and its INSERT already fires
-- log_task_activity + notify_task_event (task_assigned) for free.
--
-- Model: the ORIGINAL task a user creates is the "root" (recurring_root_id
-- is null, occurrence_number = 1). Every later occurrence is an
-- independent task row (own id, own status, own comments/attachments) that
-- points back at the root via recurring_root_id - "المهمة الأصلية لا
-- تُستبدل بالنسخ" is automatic since nothing ever updates/deletes the root.
-- "كل X أيام" is daily + recurrence_interval=X, not a separate pattern.
-- "أيام محددة" is weekly + recurrence_days_of_week (0=Sunday..6=Saturday).

alter table public.tasks
  add column recurrence_interval int not null default 1,
  add column recurrence_days_of_week int[],
  add column recurrence_end_date date,
  add column recurrence_count int,
  add column recurring_root_id uuid references public.tasks(id) on delete set null,
  add column occurrence_number int not null default 1;

alter table public.tasks
  add constraint recurrence_interval_positive check (recurrence_interval > 0),
  add constraint recurrence_count_positive check (recurrence_count is null or recurrence_count > 0),
  add constraint recurrence_days_of_week_valid check (
    recurrence_days_of_week is null or recurrence_days_of_week <@ array[0,1,2,3,4,5,6]
  );

-- generation dedup: two cron runs racing (or a run + a manual retry) must
-- never create the same occurrence twice for the same root
create unique index tasks_recurring_occurrence_unique
  on public.tasks (recurring_root_id, occurrence_number)
  where recurring_root_id is not null;

create index tasks_recurring_roots_idx on public.tasks (id)
  where is_recurring and recurring_root_id is null;

-- computes the next due_date after p_from, honoring interval/days_of_week -
-- a plain `date` has no timezone component, so this is timezone-safe by
-- construction (same reasoning as src/lib/calendar-dates.ts uses UTC to
-- avoid the same class of bug on the JS side)
create or replace function public.next_recurrence_date(
  p_from date,
  p_pattern text,
  p_interval int,
  p_days_of_week int[]
)
returns date
language plpgsql
immutable
as $$
declare
  candidate date;
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

  candidate := p_from + 1;
  while guard < (p_interval * 7 + 7) loop
    if extract(dow from candidate)::int = any(p_days_of_week) then
      return candidate;
    end if;
    candidate := candidate + 1;
    guard := guard + 1;
  end loop;

  -- unreachable given the guard bound, but never return null from a date fn
  return p_from + (p_interval || ' weeks')::interval;
end;
$$;

-- generates every occurrence that has come due for every active recurring
-- root - SECURITY DEFINER since it runs unattended from pg_cron with no
-- request/JWT context, same shape as mark_overdue_tasks/send_due_date_reminders
create or replace function public.generate_recurring_task_instances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  root record;
  last_due date;
  last_occurrence int;
  next_due date;
begin
  for root in
    select * from public.tasks
    where is_recurring and recurring_root_id is null and due_date is not null
  loop
    select coalesce(max(occurrence_number), root.occurrence_number), coalesce(max(due_date), root.due_date)
      into last_occurrence, last_due
      from public.tasks
      where id = root.id or recurring_root_id = root.id;

    next_due := public.next_recurrence_date(
      last_due, root.recurrence_pattern, root.recurrence_interval, root.recurrence_days_of_week
    );

    -- only generate what's due by today - never pre-generate far-future
    -- occurrences, and never generate more than one per cron run per root
    -- (the loop naturally re-visits any still-due root on the next run)
    continue when next_due > current_date;
    continue when root.recurrence_end_date is not null and next_due > root.recurrence_end_date;
    continue when root.recurrence_count is not null and last_occurrence + 1 > root.recurrence_count;

    insert into public.tasks (
      organization_id, title, description, assigned_to, created_by, priority, status,
      due_date, due_time, project_id, milestone_id, estimated_hours,
      is_recurring, recurring_root_id, occurrence_number
    )
    values (
      root.organization_id, root.title, root.description, root.assigned_to, root.created_by,
      root.priority, 'new', next_due, root.due_time, root.project_id, root.milestone_id,
      root.estimated_hours, false, root.id, last_occurrence + 1
    )
    on conflict (recurring_root_id, occurrence_number) do nothing;
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'generate-recurring-tasks',
  '10 0 * * *',
  $$select public.generate_recurring_task_instances()$$
);
