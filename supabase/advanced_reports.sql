-- TaskFlow Pro (MONJEZ 2.0) — Phase 15: Advanced Reporting
-- Run after projects_foundation.sql. Extends the existing Reports page
-- (notifications_and_reports.sql/reports_extended.sql) instead of
-- replacing it - Workload, Time Tracking, and SLA Compliance already have
-- their own dedicated, fully-filterable pages from Phases 06/07/08, so
-- this only adds the report types genuinely still missing: Task/Employee/
-- Department/Project Performance, Overdue breakdown, and a real Priority
-- Performance view (not just the raw count breakdown the dashboard already
-- had). All SECURITY INVOKER, same as every report_* function so far - RLS
-- on tasks/users/projects/departments is what actually scopes a
-- department_manager to their own department, this just aggregates
-- whatever the caller can already see.

-- per-department: volume, completion, overdue, average hours - one row per
-- department, filterable by a date range on updated_at (when work happened)
create or replace function public.report_department_performance(
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_priority text default null,
  p_status text default null
)
returns table (
  department_id uuid,
  department_name text,
  total_count bigint,
  completed_count bigint,
  overdue_count bigint,
  completion_rate numeric,
  avg_hours numeric
)
language sql
security invoker
stable
as $$
  select
    d.id,
    d.name,
    count(t.id) as total_count,
    count(t.id) filter (where t.status = 'completed') as completed_count,
    count(t.id) filter (where t.status = 'overdue') as overdue_count,
    case when count(t.id) = 0 then 0 else
      round(100.0 * count(t.id) filter (where t.status = 'completed') / count(t.id), 1)
    end as completion_rate,
    round(
      avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0)
        filter (where t.status = 'completed'),
      1
    ) as avg_hours
  from public.departments d
  left join public.users u on u.department_id = d.id
  left join public.tasks t on t.assigned_to = u.id
    and t.status != 'cancelled'
    and (p_since is null or t.updated_at >= p_since)
    and (p_until is null or t.updated_at < p_until)
    and (p_priority is null or t.priority = p_priority)
    and (p_status is null or t.status = p_status)
  group by d.id, d.name
  order by completion_rate desc;
$$;

-- per-employee performance across the whole scope at once (not just one
-- person, unlike report_employee_stats() which the profile page uses for a
-- single user) - filterable by department and date range
create or replace function public.report_employee_performance(
  p_department_id uuid default null,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_priority text default null,
  p_status text default null
)
returns table (
  user_id uuid,
  full_name text,
  total_count bigint,
  completed_count bigint,
  overdue_count bigint,
  completion_rate numeric,
  avg_hours numeric
)
language sql
security invoker
stable
as $$
  select
    u.id,
    u.full_name,
    count(t.id) as total_count,
    count(t.id) filter (where t.status = 'completed') as completed_count,
    count(t.id) filter (where t.status = 'overdue') as overdue_count,
    case when count(t.id) = 0 then 0 else
      round(100.0 * count(t.id) filter (where t.status = 'completed') / count(t.id), 1)
    end as completion_rate,
    round(
      avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0)
        filter (where t.status = 'completed'),
      1
    ) as avg_hours
  from public.users u
  left join public.tasks t on t.assigned_to = u.id
    and t.status != 'cancelled'
    and (p_since is null or t.updated_at >= p_since)
    and (p_until is null or t.updated_at < p_until)
    and (p_priority is null or t.priority = p_priority)
    and (p_status is null or t.status = p_status)
  where u.is_active
    and (p_department_id is null or u.department_id = p_department_id)
  group by u.id, u.full_name
  order by completion_rate desc;
$$;

-- per-project performance - a point-in-time snapshot (like
-- report_status_breakdown), no date range: "how is this project doing
-- right now" rather than "how much happened in a window"
create or replace function public.report_project_performance(
  p_project_id uuid default null,
  p_priority text default null
)
returns table (
  project_id uuid,
  project_name text,
  status text,
  total_count bigint,
  completed_count bigint,
  overdue_count bigint,
  completion_rate numeric
)
language sql
security invoker
stable
as $$
  select
    p.id,
    p.name,
    p.status,
    count(t.id) as total_count,
    count(t.id) filter (where t.status = 'completed') as completed_count,
    count(t.id) filter (where t.status = 'overdue') as overdue_count,
    case when count(t.id) = 0 then 0 else
      round(100.0 * count(t.id) filter (where t.status = 'completed') / count(t.id), 1)
    end as completion_rate
  from public.projects p
  left join public.tasks t on t.project_id = p.id
    and t.status != 'cancelled'
    and (p_priority is null or t.priority = p_priority)
  where (p_project_id is null or p.id = p_project_id)
  group by p.id, p.name, p.status
  order by completion_rate desc;
$$;

-- "Task Performance" and a real Priority Distribution, combined - not just
-- counts (the dashboard's report_task_distribution_by_priority already
-- covers raw counts), but completion rate and average resolution time per
-- priority level, filterable by date range
create or replace function public.report_priority_performance(
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  priority text,
  total_count bigint,
  completed_count bigint,
  completion_rate numeric,
  avg_hours numeric
)
language sql
security invoker
stable
as $$
  select
    t.priority,
    count(*) as total_count,
    count(*) filter (where t.status = 'completed') as completed_count,
    round(100.0 * count(*) filter (where t.status = 'completed') / count(*), 1) as completion_rate,
    round(
      avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0)
        filter (where t.status = 'completed'),
      1
    ) as avg_hours
  from public.tasks t
  where t.status != 'cancelled'
    and (p_since is null or t.updated_at >= p_since)
    and (p_until is null or t.updated_at < p_until)
  group by t.priority
  order by t.priority;
$$;

-- currently-overdue tasks, broken down by department - a snapshot, same
-- reasoning as report_project_performance (overdue is a "right now" state,
-- not a historical range)
create or replace function public.report_overdue_by_department()
returns table (department_id uuid, department_name text, overdue_count bigint)
language sql
security invoker
stable
as $$
  select
    coalesce(d.id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(d.name, 'بدون قسم'),
    count(t.id)
  from public.tasks t
  join public.users u on u.id = t.assigned_to
  left join public.departments d on d.id = u.department_id
  where t.status = 'overdue'
  group by d.id, d.name
  order by count(t.id) desc;
$$;
