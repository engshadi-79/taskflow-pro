-- TaskFlow Pro — extra report RPCs for the redesigned Reports page.
-- Run this after notifications_and_reports.sql and dashboard_extras.sql.
-- Same convention as the existing report_* functions: SECURITY INVOKER, so
-- RLS alone scopes every row to the caller's organization/department/role -
-- a department_manager calling these sees only their own department without
-- any extra WHERE clause in here.

-- one row per calendar day in [p_since, p_until]: how many tasks were
-- created that day, and how many were completed that day. Powers the top
-- stat cards' sparklines (any period, by slicing the range client-side) and
-- the monthly trend chart (by fetching ~8 months and bucketing by month
-- client-side instead of needing a second, near-duplicate RPC).
create or replace function public.report_daily_series(p_since date, p_until date default current_date)
returns table (day date, created_count bigint, completed_count bigint)
language sql
security invoker
stable
as $$
  -- generate_series has no (date, date, interval) overload - only
  -- (timestamp, timestamp, interval) - hence the explicit casts.
  select
    gs.day::date,
    (select count(*) from public.tasks t where t.created_at::date = gs.day::date),
    (select count(*) from public.tasks t where t.status = 'completed' and t.updated_at::date = gs.day::date)
  from generate_series(p_since::timestamp, p_until::timestamp, interval '1 day') as gs(day)
  order by gs.day;
$$;

-- average completion time per department, in hours (completed tasks only)
create or replace function public.report_avg_hours_by_department()
returns table (department_name text, avg_hours numeric)
language sql
security invoker
stable
as $$
  select coalesce(d.name, 'بدون قسم') as department_name,
         round(avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0), 1) as avg_hours
  from public.tasks t
  join public.users u on u.id = t.assigned_to
  left join public.departments d on d.id = u.department_id
  where t.status = 'completed'
  group by d.name
  order by avg_hours asc nulls last;
$$;

-- current snapshot of how many (non-cancelled) tasks sit in each status
create or replace function public.report_status_breakdown()
returns table (status text, task_count bigint)
language sql
security invoker
stable
as $$
  select status, count(*)
  from public.tasks
  where status != 'cancelled'
  group by status
  order by count(*) desc;
$$;
