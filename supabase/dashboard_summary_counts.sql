-- TaskFlow Pro — consolidates the dashboard home page's ~18 separate
-- count(*)-only round trips (users/departments/tasks/workflow_requests/
-- notifications/projects) into a single RPC call. SECURITY INVOKER so RLS
-- scopes every sub-count exactly as the individual queries did before
-- (org scoping for users/departments/projects, department_manager's own
-- department for tasks, notifications_select's own-user scoping, etc.) —
-- this is purely a network-round-trip optimization, not a behavior change.
-- Run this after dashboard_extras.sql.

create or replace function public.dashboard_summary_counts(
  p_employee_id uuid,
  p_employee_ids uuid[],
  p_project_id uuid,
  p_status text,
  p_priority text,
  p_since timestamptz,
  p_two_weeks_ago timestamptz,
  p_today date
)
returns table (
  employee_count bigint,
  total_members bigint,
  department_count bigint,
  completed_count bigint,
  total_count bigint,
  pending_count bigint,
  active_count bigint,
  team_overdue_count bigint,
  pending_review_count bigint,
  pending_approvals_count bigint,
  unread_count bigint,
  completed_this_week bigint,
  completed_last_week bigint,
  new_this_week bigint,
  new_last_week bigint,
  project_count bigint,
  my_overdue_count bigint,
  my_due_today_count bigint
)
language sql
security invoker
stable
as $$
  with base_tasks as (
    select *
    from public.tasks t
    where (p_employee_id is null or t.assigned_to = p_employee_id)
      and (
        p_employee_id is not null
        or p_employee_ids is null
        or t.assigned_to = any(p_employee_ids)
      )
      and (p_project_id is null or t.project_id = p_project_id)
      and (p_status is null or t.status = p_status)
      and (p_priority is null or t.priority = p_priority)
  ),
  task_counts as (
    select
      count(*) filter (where status = 'completed') as completed_count,
      count(*) as total_count,
      count(*) filter (where status in ('new', 'in_progress', 'pending_review')) as pending_count,
      count(*) filter (where status in ('new', 'in_progress')) as active_count,
      count(*) filter (where status = 'overdue') as team_overdue_count,
      count(*) filter (where status = 'pending_review') as pending_review_count,
      count(*) filter (where status = 'completed' and updated_at >= p_since) as completed_this_week,
      count(*) filter (
        where status = 'completed' and updated_at >= p_two_weeks_ago and updated_at < p_since
      ) as completed_last_week,
      count(*) filter (where created_at >= p_since) as new_this_week,
      count(*) filter (
        where created_at >= p_two_weeks_ago and created_at < p_since
      ) as new_last_week
    from base_tasks
  ),
  my_tasks as (
    select
      count(*) filter (where status <> 'completed' and due_date < p_today) as my_overdue_count,
      count(*) filter (where status <> 'completed' and due_date = p_today) as my_due_today_count
    from public.tasks
    where assigned_to = auth.uid()
  )
  select
    (select count(*) from public.users where role = 'employee') as employee_count,
    (select count(*) from public.users) as total_members,
    (select count(*) from public.departments) as department_count,
    tc.completed_count,
    tc.total_count,
    tc.pending_count,
    tc.active_count,
    tc.team_overdue_count,
    tc.pending_review_count,
    (
      select count(*) from public.workflow_requests
      where status = 'pending' and requested_by <> auth.uid()
    ) as pending_approvals_count,
    (select count(*) from public.notifications where is_read = false) as unread_count,
    tc.completed_this_week,
    tc.completed_last_week,
    tc.new_this_week,
    tc.new_last_week,
    (select count(*) from public.projects) as project_count,
    mt.my_overdue_count,
    mt.my_due_today_count
  from task_counts tc, my_tasks mt;
$$;
