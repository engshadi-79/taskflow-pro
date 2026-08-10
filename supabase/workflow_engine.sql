-- TaskFlow Pro (MONJEZ 2.0) — Phase 09: Workflow Engine
-- Run after projects_foundation.sql. One generic engine (Trigger -> Steps ->
-- Conditions -> Approvals -> Actions), not a separate table/flow per request
-- type - "طلب إجازة"/"طلب شراء"/"طلب صيانة" are just different
-- workflow_templates rows, reusing this same engine.
--
-- No new permission system: an approver at a step is one of
-- 'department_manager' (the requester's own department's manager_id),
-- 'super_admin' (this org's top authority - standing in for the plan's
-- "HR"/"General Manager" since neither role exists in this project's
-- three-role model, and Prompt 00 forbids inventing a new one), or
-- 'specific_user' (an explicit person, e.g. a maintenance assignee).

-- ============================================================
-- workflow_templates + workflow_steps
-- ============================================================
create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  position integer not null check (position > 0),
  name text not null,
  approver_type text not null check (approver_type in ('department_manager', 'super_admin', 'specific_user')),
  specific_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, position),
  constraint workflow_steps_specific_user_required check (
    (approver_type = 'specific_user' and specific_user_id is not null)
    or (approver_type != 'specific_user')
  )
);

create index workflow_templates_organization_id_idx on public.workflow_templates(organization_id);
create index workflow_steps_template_id_idx on public.workflow_steps(template_id);

alter table public.workflow_templates enable row level security;
alter table public.workflow_steps enable row level security;

create policy workflow_templates_select on public.workflow_templates
  for select using (organization_id = public.current_org_id());

create policy workflow_templates_write on public.workflow_templates
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy workflow_steps_select on public.workflow_steps
  for select using (exists (select 1 from public.workflow_templates t where t.id = template_id));

create policy workflow_steps_write on public.workflow_steps
  for all using (
    exists (
      select 1 from public.workflow_templates t
      where t.id = template_id and t.organization_id = public.current_org_id()
        and public.current_user_role() = 'super_admin'
    )
  );

-- ============================================================
-- workflow_requests + workflow_actions (the audit log: من/متى/ماذا فعل/
-- النتيجة/الملاحظة - actor_id/created_at/action_type/(effect implied by
-- action_type)/note respectively)
-- ============================================================
create table public.workflow_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  details text,
  current_step_position integer not null default 1,
  -- escalate() sets this true to widen "who may act" to any super_admin for
  -- the current step, without needing to know which specific person to pick
  is_escalated boolean not null default false,
  -- reassign() targets a specific person for the current step only; cleared
  -- automatically on the next approve/return
  current_step_override_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflow_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workflow_requests(id) on delete cascade,
  step_position integer not null,
  actor_id uuid not null references public.users(id) on delete set null,
  action_type text not null check (
    action_type in ('submit', 'approve', 'reject', 'return', 'escalate', 'reassign', 'cancel')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index workflow_requests_organization_id_idx on public.workflow_requests(organization_id);
create index workflow_requests_requested_by_idx on public.workflow_requests(requested_by);
create index workflow_requests_template_id_idx on public.workflow_requests(template_id);
create index workflow_actions_request_id_idx on public.workflow_actions(request_id);

create trigger workflow_requests_set_updated_at
  before update on public.workflow_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- can_act_on_workflow_request: resolves whether auth.uid() is the current
-- step's approver. SECURITY DEFINER so it can read workflow_requests/
-- workflow_steps/departments itself without triggering those tables' own
-- RLS policies, which in turn call this function - the exact
-- projects<->project_members recursion trap from Phase 02, avoided the same
-- way (a SECURITY DEFINER helper, not a raw cross-table subquery inside a
-- policy).
-- ============================================================
create function public.can_act_on_workflow_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  step record;
  requester_dept uuid;
  dept_manager uuid;
begin
  if public.current_user_role() = 'super_admin' then
    return true;
  end if;

  select * into req from public.workflow_requests where id = p_request_id;
  if req is null or req.status != 'pending' then
    return false;
  end if;

  if req.current_step_override_user_id is not null then
    return req.current_step_override_user_id = auth.uid();
  end if;

  if req.is_escalated then
    -- escalated steps are only actionable by super_admin, already returned
    -- true above for that role
    return false;
  end if;

  select * into step from public.workflow_steps
    where template_id = req.template_id and position = req.current_step_position;
  if step is null then
    return false;
  end if;

  if step.approver_type = 'specific_user' then
    return step.specific_user_id = auth.uid();
  elsif step.approver_type = 'department_manager' then
    select department_id into requester_dept from public.users where id = req.requested_by;
    select manager_id into dept_manager from public.departments where id = requester_dept;
    return dept_manager is not null and dept_manager = auth.uid();
  end if;

  -- approver_type = 'super_admin' with a non-super_admin caller: no match
  return false;
end;
$$;

alter table public.workflow_requests enable row level security;
alter table public.workflow_actions enable row level security;

-- No insert/update/delete policies on either table on purpose - every
-- mutation goes through submit_workflow_request()/act_on_workflow_request()
-- below (both SECURITY DEFINER, so they bypass RLS from inside their own
-- body after doing their own authorization check). Same reasoning as
-- update_department_employee() earlier in this project: a raw permissive
-- UPDATE policy here could not distinguish "advance one step" from
-- "silently jump straight to approved", since RLS only ever sees rows, not
-- the semantics of the change.
create policy workflow_requests_select on public.workflow_requests
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or requested_by = auth.uid()
      or public.can_act_on_workflow_request(id)
    )
  );

create policy workflow_actions_select on public.workflow_actions
  for select using (exists (select 1 from public.workflow_requests r where r.id = request_id));

-- ============================================================
-- submit_workflow_request: the only way a request row is ever created.
-- ============================================================
create function public.submit_workflow_request(
  p_template_id uuid,
  p_title text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  org uuid;
begin
  select organization_id into org from public.users where id = auth.uid();

  if org is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception 'عنوان الطلب مطلوب';
  end if;
  if not exists (select 1 from public.workflow_templates where id = p_template_id and organization_id = org and is_active) then
    raise exception 'نوع الطلب غير صالح';
  end if;

  insert into public.workflow_requests (organization_id, template_id, requested_by, title, details, current_step_position, status)
  values (org, p_template_id, auth.uid(), trim(p_title), p_details, 1, 'pending')
  returning id into new_id;

  insert into public.workflow_actions (request_id, step_position, actor_id, action_type, note)
  values (new_id, 1, auth.uid(), 'submit', null);

  return new_id;
end;
$$;

-- ============================================================
-- act_on_workflow_request: the only way a request row is ever changed -
-- approve/reject/return/escalate/reassign/cancel, each re-checking
-- authorization itself (can_act_on_workflow_request(), or "is the
-- requester" for cancel) instead of trusting that the caller reached this
-- function through the "right" UI button.
-- ============================================================
create function public.act_on_workflow_request(
  p_request_id uuid,
  p_action text,
  p_note text default null,
  p_target_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.workflow_requests;
  caller uuid := auth.uid();
  max_position integer;
begin
  select * into req from public.workflow_requests where id = p_request_id;
  if req is null then
    raise exception 'الطلب غير موجود';
  end if;

  if p_action = 'cancel' then
    if req.requested_by != caller then
      raise exception 'فقط مقدّم الطلب يمكنه إلغاءه';
    end if;
    if req.status != 'pending' then
      raise exception 'لا يمكن إلغاء طلب غير معلَّق';
    end if;
    update public.workflow_requests set status = 'cancelled' where id = p_request_id;

  elsif p_action in ('approve', 'reject', 'return', 'escalate', 'reassign') then
    if req.status != 'pending' then
      raise exception 'هذا الطلب ليس معلَّقًا حاليًا';
    end if;
    if not public.can_act_on_workflow_request(p_request_id) then
      raise exception 'غير مصرح لك باتخاذ إجراء على هذا الطلب';
    end if;

    if p_action = 'approve' then
      select max(position) into max_position from public.workflow_steps where template_id = req.template_id;
      if req.current_step_position >= coalesce(max_position, 1) then
        update public.workflow_requests
          set status = 'approved', current_step_override_user_id = null, is_escalated = false
          where id = p_request_id;
      else
        update public.workflow_requests
          set current_step_position = current_step_position + 1,
              current_step_override_user_id = null, is_escalated = false
          where id = p_request_id;
      end if;

    elsif p_action = 'reject' then
      update public.workflow_requests set status = 'rejected' where id = p_request_id;

    elsif p_action = 'return' then
      update public.workflow_requests
        set current_step_position = greatest(1, current_step_position - 1),
            current_step_override_user_id = null, is_escalated = false
        where id = p_request_id;

    elsif p_action = 'escalate' then
      update public.workflow_requests set is_escalated = true where id = p_request_id;

    elsif p_action = 'reassign' then
      if p_target_user_id is null then
        raise exception 'حدد الشخص الذي تريد إعادة التعيين إليه';
      end if;
      update public.workflow_requests
        set current_step_override_user_id = p_target_user_id, is_escalated = false
        where id = p_request_id;
    end if;
  else
    raise exception 'إجراء غير معروف: %', p_action;
  end if;

  insert into public.workflow_actions (request_id, step_position, actor_id, action_type, note)
  values (p_request_id, req.current_step_position, caller, p_action, p_note);
end;
$$;
