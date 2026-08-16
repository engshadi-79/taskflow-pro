-- MONJEZ 3.0 P13 — Executive Decision Center
-- The BI/reports layer (advanced_reports.sql, reports_extended.sql,
-- notifications_and_reports.sql, sla_engine.sql) is already rich; what's
-- missing per PROJECT(3).md is a "what happened / why / recommended action"
-- narrative layer on top of it. Three of the metrics that layer needs
-- (delay rate, avg completion hours, SLA compliance) have no period
-- filtering today, so a real current-vs-previous-period comparison isn't
-- possible for them yet - this file adds that, the same way
-- report_department_performance/report_review_rejection_rate already do.
--
-- These are new overloads, not edits to the existing zero/two-arg
-- functions: Postgres resolves a call requiring zero default substitutions
-- to the original function, so every existing caller (reports/page.tsx)
-- keeps hitting the original unchanged. Only a call that actually supplies
-- p_since/p_until resolves to the new overload below.

create or replace function public.report_delay_rate(
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_department_id uuid default null
)
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
  where status != 'cancelled'
    and (p_since is null or updated_at >= p_since)
    and (p_until is null or updated_at < p_until)
    and (p_department_id is null or assigned_to in (select id from public.users where department_id = p_department_id));
$$;

create or replace function public.report_avg_completion_hours(
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_department_id uuid default null
)
returns numeric
language sql
security invoker
stable
as $$
  select round(avg(extract(epoch from (updated_at - created_at)) / 3600.0), 1)
  from public.tasks
  where status = 'completed'
    and (p_since is null or updated_at >= p_since)
    and (p_until is null or updated_at < p_until)
    and (p_department_id is null or assigned_to in (select id from public.users where department_id = p_department_id));
$$;

create or replace function public.sla_report(
  p_department_id uuid default null,
  p_user_id uuid default null,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  total_count bigint,
  breached_count bigint,
  compliance_rate numeric,
  avg_response_minutes numeric,
  avg_resolution_hours numeric
)
language sql
security invoker
stable
as $$
  with scored as (
    select
      t.status, t.created_at, t.updated_at, t.responded_at,
      t.created_at + (p.resolution_minutes || ' minutes')::interval as resolution_due
    from public.tasks t
    join public.sla_policies p
      on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
    where t.status != 'cancelled'
      and (p_department_id is null or t.assigned_to in (select id from public.users where department_id = p_department_id))
      and (p_user_id is null or t.assigned_to = p_user_id)
      and (p_since is null or t.created_at >= p_since)
      and (p_until is null or t.created_at < p_until)
  ),
  flagged as (
    select
      *,
      (status = 'completed' and updated_at > resolution_due)
        or (status != 'completed' and now() > resolution_due) as is_breached
    from scored
  )
  select
    count(*) as total_count,
    count(*) filter (where is_breached) as breached_count,
    case when count(*) = 0 then 100 else
      round(100.0 * count(*) filter (where not is_breached) / count(*), 1)
    end as compliance_rate,
    round(avg(extract(epoch from (responded_at - created_at)) / 60.0) filter (where responded_at is not null), 1) as avg_response_minutes,
    round(avg(extract(epoch from (updated_at - created_at)) / 3600.0) filter (where status = 'completed'), 1) as avg_resolution_hours
  from flagged;
$$;
