-- TaskFlow Pro (MONJEZ 2.0) — Phase 03: project task stats
-- Run after projects_foundation.sql + projects_foundation_fix.sql.
-- Same convention as report_employee_stats()/report_*: SECURITY INVOKER, so
-- RLS on tasks (not this function) decides what the caller can actually
-- count - a department_manager calling this for a project outside their
-- department just gets zeros, since tasks_select already hides those rows.
--
-- This is what "نسبة إنجاز المشروع" is computed from - never a manually
-- entered number, and never N separate queries from the page (one RPC call
-- per project instead of counting client-side across a full task fetch).
create or replace function public.project_task_stats(p_project_id uuid)
returns table (
  total_count bigint,
  completed_count bigint,
  in_progress_count bigint,
  overdue_count bigint,
  completion_rate numeric
)
language sql
security invoker
stable
as $$
  select
    count(*) as total_count,
    count(*) filter (where status = 'completed') as completed_count,
    count(*) filter (where status = 'in_progress') as in_progress_count,
    count(*) filter (where status = 'overdue') as overdue_count,
    case when count(*) = 0 then 0 else
      round(100.0 * count(*) filter (where status = 'completed') / count(*), 1)
    end as completion_rate
  from public.tasks
  where project_id = p_project_id and status != 'cancelled';
$$;
