-- TaskFlow Pro — dashboard redesign: activity log trigger + extra report RPCs
-- Run this after notifications_and_reports.sql.

-- ============================================================
-- activity_log trigger (the table existed since schema.sql but
-- nothing ever wrote to it — this fills "آخر النشاطات" on the
-- dashboard). SECURITY DEFINER because activity_log's insert
-- policy only allows a row where user_id = auth.uid(); running
-- as definer still resolves auth.uid() correctly (it reads the
-- request JWT, unaffected by SECURITY DEFINER), it just bypasses
-- the RLS check itself so the trigger can never be blocked.
-- ============================================================
create function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_ar text;
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (new.organization_id, auth.uid(), 'create', 'task', new.id, 'أنشأ مهمة: ' || new.title);
    return new;
  end if;

  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    status_ar := case new.status
      when 'new' then 'جديدة'
      when 'in_progress' then 'قيد التنفيذ'
      when 'pending_review' then 'بانتظار المراجعة'
      when 'completed' then 'مكتملة'
      when 'overdue' then 'متأخرة'
      when 'cancelled' then 'ملغاة'
      else new.status
    end;
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (new.organization_id, auth.uid(), 'status_change', 'task', new.id, 'حالة المهمة "' || new.title || '" أصبحت: ' || status_ar);
    return new;
  end if;

  return new;
end;
$$;

create trigger tasks_log_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- ============================================================
-- extra report RPCs (SECURITY INVOKER — RLS scopes results
-- automatically, same pattern as notifications_and_reports.sql)
-- ============================================================
create function public.report_weekly_top_employees()
returns table (user_id uuid, full_name text, completed_count bigint)
language sql
security invoker
stable
as $$
  select u.id, u.full_name, count(t.id) as completed_count
  from public.users u
  join public.tasks t
    on t.assigned_to = u.id
    and t.status = 'completed'
    and t.updated_at >= now() - interval '7 days'
  group by u.id, u.full_name
  order by completed_count desc
  limit 4;
$$;

create function public.report_task_distribution_by_department()
returns table (department_name text, task_count bigint)
language sql
security invoker
stable
as $$
  select coalesce(d.name, 'بدون قسم'), count(t.id)
  from public.tasks t
  join public.users u on u.id = t.assigned_to
  left join public.departments d on d.id = u.department_id
  where t.status != 'cancelled'
  group by d.name
  order by count(t.id) desc;
$$;

create function public.report_task_distribution_by_priority()
returns table (priority text, task_count bigint)
language sql
security invoker
stable
as $$
  select priority, count(*) as task_count
  from public.tasks
  where status != 'cancelled'
  group by priority
  order by count(*) desc;
$$;

create function public.report_weekly_trend()
returns table (day date, completed_count bigint)
language sql
security invoker
stable
as $$
  select gs.day, count(t.id)
  from generate_series(current_date - interval '6 days', current_date, interval '1 day') as gs(day)
  left join public.tasks t
    on t.status = 'completed'
    and t.updated_at::date = gs.day::date
  group by gs.day
  order by gs.day;
$$;

-- ============================================================
-- dashboard_summary_counts: consolidates the dashboard home page's
-- ~18 separate count(*)-only round trips into a single RPC call.
-- SECURITY INVOKER so RLS scopes every sub-count exactly as the
-- individual queries did before it (org scoping for
-- users/departments/projects, department_manager's own department
-- for tasks, notifications_select's own-user scoping, etc.) - this
-- is purely a network-round-trip optimization, not a behavior change.
-- ============================================================
create function public.dashboard_summary_counts(
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
