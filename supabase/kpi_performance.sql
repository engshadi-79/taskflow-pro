-- MONJEZ 3.0 — P08: KPI & Performance
-- Run after schema.sql, rls.sql, review_rejection_rate.sql.
--
-- Weighted composite score (Completion 30% + On-Time 25% + Quality 25% +
-- Manager Evaluation 20%, per the plan's own example weights) built on
-- metrics that already exist rather than inventing new ones for 3 of the
-- 4 components:
--   - Completion & On-Time: same definitions report_employee_stats()
--     already uses (that function itself is untouched - it's lifetime,
--     not period-scoped, so this adds a period-scoped sibling rather than
--     changing its signature and risking its existing caller, the
--     profile page).
--   - Quality: reuses task_reviews/report_review_rejection_rate()
--     (review_rejection_rate.sql) inverted (fewer rejections = higher
--     quality) - extended with an optional p_user_id filter rather than
--     duplicated, since the existing function only filtered by department.
--   - Manager Evaluation: the one genuinely new input - a human number,
--     never computed, per the plan's own rule that AI/the system never
--     decides the evaluation alone.
--
-- "المدير يراجع النتائج" / "تاريخ القياسات محفوظ" become concrete here as
-- a two-step lifecycle: create_employee_kpi_evaluation() computes and
-- freezes the 3 automatic components as a real historical row
-- (pending_manager_review); finalize_employee_kpi_evaluation() is the
-- manager's review step - only after they've entered their own score does
-- a total_score exist at all, and the row becomes immutable.

-- ============================================================
-- report_review_rejection_rate: add an optional per-employee filter
-- (existing p_department_id stays as-is, both can be combined)
-- ============================================================

create or replace function public.report_review_rejection_rate(
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_department_id uuid default null,
  p_user_id uuid default null
)
returns table (total_reviews bigint, rejected_count bigint, rejection_rate numeric)
language sql
security invoker
stable
as $$
  select
    count(*),
    count(*) filter (where r.decision = 'reject'),
    case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where r.decision = 'reject') / count(*), 1) end
  from public.task_reviews r
  join public.tasks t on t.id = r.task_id
  where (p_since is null or r.created_at >= p_since)
    and (p_until is null or r.created_at < p_until)
    and (p_user_id is null or t.assigned_to = p_user_id)
    and (
      p_department_id is null
      or t.assigned_to in (select id from public.users where department_id = p_department_id)
    );
$$;

-- ============================================================
-- employee_kpi_evaluations: one row per (employee, period). No insert/
-- update policy on purpose - route through the two functions below, same
-- pattern as every other privilege-scoped table this project has
-- (admin_notifications, workflow_requests, ...).
-- ============================================================

create table public.employee_kpi_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  completion_score numeric not null,
  on_time_score numeric not null,
  quality_score numeric not null,
  manager_evaluation_score numeric check (manager_evaluation_score is null or manager_evaluation_score between 0 and 100),
  manager_note text,
  evaluated_by uuid references public.users(id) on delete set null,
  total_score numeric,
  status text not null default 'pending_manager_review' check (status in ('pending_manager_review', 'finalized')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  check (period_end >= period_start),
  unique (user_id, period_start, period_end)
);

create index employee_kpi_evaluations_user_id_idx on public.employee_kpi_evaluations(user_id);
create index employee_kpi_evaluations_org_idx on public.employee_kpi_evaluations(organization_id);

alter table public.employee_kpi_evaluations enable row level security;

create policy employee_kpi_evaluations_select on public.employee_kpi_evaluations
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or user_id = auth.uid()
      or (
        public.current_user_role() = 'department_manager'
        and user_id in (select id from public.users where department_id = public.current_department_id())
      )
    )
  );

-- ============================================================
-- compute_employee_kpi_components: the 3 automatic parts, period-scoped.
-- SECURITY INVOKER, same reasoning as report_employee_stats() - RLS on
-- tasks already scopes what the caller can see (a department_manager's
-- own department, super_admin everything), so no DEFINER escalation is
-- needed just to compute a number from rows already visible to them.
-- ============================================================

create or replace function public.compute_employee_kpi_components(
  p_user_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (completion_score numeric, on_time_score numeric, quality_score numeric)
language plpgsql
security invoker
stable
as $$
declare
  v_total bigint;
  v_completed bigint;
  v_completed_with_due bigint;
  v_ontime bigint;
  v_rejection record;
begin
  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'completed' and due_date is not null),
    count(*) filter (
      where status = 'completed' and due_date is not null
        and updated_at <= (due_date + coalesce(due_time, '23:59:59'::time))
    )
  into v_total, v_completed, v_completed_with_due, v_ontime
  from public.tasks
  where assigned_to = p_user_id
    and created_at::date between p_period_start and p_period_end;

  select * into v_rejection from public.report_review_rejection_rate(
    p_period_start::timestamptz, (p_period_end + 1)::timestamptz, null, p_user_id
  );

  completion_score := case when v_total = 0 then 0 else round(100.0 * v_completed / v_total, 1) end;
  on_time_score := case when v_completed_with_due = 0 then 100 else round(100.0 * v_ontime / v_completed_with_due, 1) end;
  quality_score := case when coalesce(v_rejection.total_reviews, 0) = 0 then 100 else round(100 - v_rejection.rejection_rate, 1) end;

  return next;
end;
$$;

-- ============================================================
-- create_employee_kpi_evaluation: freezes the 3 automatic components as a
-- real row - re-running this later for the same period fails (unique
-- constraint), so a period's automatic snapshot never silently drifts
-- after the fact.
-- ============================================================

create or replace function public.create_employee_kpi_evaluation(
  p_user_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_user_role();
  caller_org uuid := public.current_org_id();
  caller_dept uuid;
  target_dept uuid;
  comp record;
  new_id uuid;
begin
  if caller_role not in ('super_admin', 'department_manager') then
    raise exception 'غير مصرح لك بإنشاء تقييم أداء';
  end if;

  select department_id into target_dept from public.users where id = p_user_id and organization_id = caller_org;
  if not found then
    raise exception 'الموظف غير موجود';
  end if;

  if caller_role = 'department_manager' then
    select department_id into caller_dept from public.users where id = auth.uid();
    if target_dept is distinct from caller_dept then
      raise exception 'يمكنك تقييم موظفي قسمك فقط';
    end if;
  end if;

  select * into comp from public.compute_employee_kpi_components(p_user_id, p_period_start, p_period_end);

  insert into public.employee_kpi_evaluations (
    organization_id, user_id, period_start, period_end,
    completion_score, on_time_score, quality_score, status
  )
  values (
    caller_org, p_user_id, p_period_start, p_period_end,
    comp.completion_score, comp.on_time_score, comp.quality_score, 'pending_manager_review'
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ============================================================
-- finalize_employee_kpi_evaluation: the manager-review step. The manager
-- score is the ONLY input a human types in - the other 3 were already
-- frozen at creation time - and total_score only ever gets computed here,
-- never anywhere else, so "AI/the system doesn't decide the evaluation
-- alone" holds by construction: no total exists until a person supplies
-- the 20% manager component.
-- ============================================================

create or replace function public.finalize_employee_kpi_evaluation(
  p_evaluation_id uuid,
  p_manager_evaluation_score numeric,
  p_manager_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_user_role();
  caller_dept uuid;
  target_dept uuid;
  ev public.employee_kpi_evaluations;
  total numeric;
begin
  if p_manager_evaluation_score is null or p_manager_evaluation_score < 0 or p_manager_evaluation_score > 100 then
    raise exception 'تقييم المدير يجب أن يكون رقمًا بين 0 و100';
  end if;

  select * into ev from public.employee_kpi_evaluations where id = p_evaluation_id;
  if ev is null then
    raise exception 'التقييم غير موجود';
  end if;
  if ev.status = 'finalized' then
    raise exception 'تم اعتماد هذا التقييم مسبقًا';
  end if;

  if caller_role not in ('super_admin', 'department_manager') then
    raise exception 'غير مصرح لك باعتماد تقييم أداء';
  end if;

  if caller_role = 'department_manager' then
    select department_id into caller_dept from public.users where id = auth.uid();
    select department_id into target_dept from public.users where id = ev.user_id;
    if target_dept is distinct from caller_dept then
      raise exception 'يمكنك اعتماد تقييم موظفي قسمك فقط';
    end if;
  end if;

  total := round(
    ev.completion_score * 0.30 + ev.on_time_score * 0.25 + ev.quality_score * 0.25 + p_manager_evaluation_score * 0.20,
    1
  );

  update public.employee_kpi_evaluations
  set manager_evaluation_score = p_manager_evaluation_score,
      manager_note = p_manager_note,
      total_score = total,
      status = 'finalized',
      evaluated_by = auth.uid(),
      finalized_at = now()
  where id = p_evaluation_id;
end;
$$;

revoke all on function public.create_employee_kpi_evaluation(uuid, date, date) from public;
grant execute on function public.create_employee_kpi_evaluation(uuid, date, date) to authenticated;
revoke all on function public.finalize_employee_kpi_evaluation(uuid, numeric, text) from public;
grant execute on function public.finalize_employee_kpi_evaluation(uuid, numeric, text) to authenticated;
