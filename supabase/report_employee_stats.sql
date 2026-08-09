-- TaskFlow Pro — per-employee stats for the profile page's stat cards.
-- Run after schema.sql and rls.sql. Same convention as the report_*
-- functions in notifications_and_reports.sql/reports_extended.sql:
-- SECURITY INVOKER, so RLS on tasks scopes what the caller can actually see
-- (an employee only ever sees their own tasks in the underlying table; the
-- profile page's own canView check on top of that is what stops one
-- employee from even reaching another's profile.tsx page to call this for
-- p_user_id = someone else).
create or replace function public.report_employee_stats(p_user_id uuid)
returns table (
  completed_count bigint,
  on_time_rate numeric,
  avg_completion_hours numeric
)
language sql
security invoker
stable
as $$
  select
    count(*) as completed_count,
    case when count(*) = 0 then 0 else
      round(
        100.0 * count(*) filter (
          where due_date is null
            or updated_at <= (due_date + coalesce(due_time, '23:59:59'::time))
        ) / count(*),
        1
      )
    end as on_time_rate,
    coalesce(round(avg(extract(epoch from (updated_at - created_at)) / 3600.0), 1), 0) as avg_completion_hours
  from public.tasks
  where assigned_to = p_user_id and status = 'completed';
$$;
