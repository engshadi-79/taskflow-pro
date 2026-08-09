-- TaskFlow Pro (MONJEZ 2.0) — Phase 06: Workload
-- Run after projects_foundation.sql (needs tasks.project_id for the
-- optional project filter). SECURITY INVOKER like every report_* function -
-- RLS on tasks/users already scopes a department_manager to their own
-- department and an org to itself, so the workload numbers a caller sees
-- are never wider than what they could already see task-by-task.
--
-- "الوقت المقدر" (estimated hours) is explicitly listed in Prompt 06 as a
-- load factor "إن كان متاحًا" - it isn't: tasks has no estimated-time
-- column anywhere in schema.sql. Rather than invent one or fake a number,
-- the score below is built only from columns that actually exist: open
-- task count, priority, overdue status, and due-date proximity. Same
-- principle already applied earlier in this project when the Reports page
-- hit a similar gap for "estimated time" and used real columns instead.
--
-- load_score per employee = sum over their open tasks of:
--   priority weight (low=1, medium=2, high=3, urgent=5)
--   + 3 if the task is currently overdue
--   + 2 if it's due within 2 days and not already overdue
-- 15 points is treated as "at capacity" (100%) - four medium tasks plus one
-- urgent one lands almost exactly there, which reads as a reasonable full
-- plate for one person. This constant is a judgment call, not a measured
-- one; it's centralized here so Dashboard/Reports (later phases) can reuse
-- the exact same definition of "overloaded" instead of redefining it.
create or replace function public.employee_workload(
  p_department_id uuid default null,
  p_project_id uuid default null,
  p_due_before date default null
)
returns table (
  user_id uuid,
  full_name text,
  department_id uuid,
  open_count bigint,
  urgent_count bigint,
  overdue_count bigint,
  in_progress_count bigint,
  load_score numeric,
  load_percent numeric,
  load_status text
)
language sql
security invoker
stable
as $$
  with open_tasks as (
    select t.*
    from public.tasks t
    where t.status in ('new', 'in_progress', 'pending_review', 'overdue')
      and (p_project_id is null or t.project_id = p_project_id)
      and (p_due_before is null or t.due_date is null or t.due_date <= p_due_before)
  ),
  scored as (
    select
      assigned_to as uid,
      count(*) as open_count,
      count(*) filter (where priority = 'urgent') as urgent_count,
      count(*) filter (where status = 'overdue') as overdue_count,
      count(*) filter (where status = 'in_progress') as in_progress_count,
      sum(
        (case priority
          when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'urgent' then 5
          else 2
        end)
        + (case when status = 'overdue' then 3 else 0 end)
        + (case when due_date is not null and due_date <= current_date + 2 and status != 'overdue' then 2 else 0 end)
      ) as load_score
    from open_tasks
    group by assigned_to
  )
  select
    u.id as user_id,
    u.full_name,
    u.department_id,
    coalesce(s.open_count, 0) as open_count,
    coalesce(s.urgent_count, 0) as urgent_count,
    coalesce(s.overdue_count, 0) as overdue_count,
    coalesce(s.in_progress_count, 0) as in_progress_count,
    coalesce(s.load_score, 0) as load_score,
    round(least(100, coalesce(s.load_score, 0) / 15.0 * 100), 1) as load_percent,
    case
      when coalesce(s.load_score, 0) / 15.0 * 100 >= 100 then 'critical'
      when coalesce(s.load_score, 0) / 15.0 * 100 >= 70 then 'high'
      when coalesce(s.load_score, 0) / 15.0 * 100 >= 40 then 'normal'
      else 'low'
    end as load_status
  from public.users u
  left join scored s on s.uid = u.id
  where u.is_active
    and (p_department_id is null or u.department_id = p_department_id)
  order by coalesce(s.load_score, 0) desc;
$$;
