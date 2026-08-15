-- MONJEZ 3.0 — P07: Approval Center
-- Run after workflow_engine.sql, request_center.sql, workflow_builder.sql.
--
-- No parallel approval system - this extends the two approval mechanisms
-- that already exist (can_act_on_workflow_request() for workflow_requests,
-- act_on_flow_approval() for the P06 flow builder) with delegation, and
-- adds auto-escalation on SLA breach + bulk approve as new capabilities.
-- The unified "Pending Approvals" inbox itself needs no new SQL at all -
-- workflow_requests_select's existing RLS (which already calls
-- can_act_on_workflow_request()) already returns exactly the pending
-- requests a viewer may act on with a plain `select ... where
-- status = 'pending'`.

-- ============================================================
-- approval_delegations: "while I'm away, let X act on my approvals" -
-- self-service (a delegator can only delegate their OWN authority, RLS
-- enforces this), and only has any effect at the moment
-- can_act_on_workflow_request()/act_on_flow_approval() actually resolve an
-- approver - creating one for someone who never approves anything is
-- harmless, so no extra role gate is needed on top of RLS.
-- ============================================================

create table public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delegator_id uuid not null references public.users(id) on delete cascade,
  delegate_id uuid not null references public.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (delegate_id != delegator_id)
);

create index approval_delegations_delegator_idx on public.approval_delegations(delegator_id);
create index approval_delegations_delegate_idx on public.approval_delegations(delegate_id);

alter table public.approval_delegations enable row level security;

create policy approval_delegations_select on public.approval_delegations
  for select using (
    organization_id = public.current_org_id()
    and (delegator_id = auth.uid() or delegate_id = auth.uid() or public.current_user_role() = 'super_admin')
  );

create policy approval_delegations_insert on public.approval_delegations
  for insert with check (
    organization_id = public.current_org_id()
    and delegator_id = auth.uid()
    and exists (select 1 from public.users u where u.id = delegate_id and u.organization_id = public.current_org_id())
  );

create policy approval_delegations_delete on public.approval_delegations
  for delete using (delegator_id = auth.uid() or public.current_user_role() = 'super_admin');

create or replace function public.is_active_approval_delegate(p_delegator uuid, p_delegate uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_delegations
    where delegator_id = p_delegator and delegate_id = p_delegate
      and now() between starts_at and ends_at
  );
$$;

-- ============================================================
-- can_act_on_workflow_request: same resolution logic as before, refactored
-- to resolve a single `resolved_approver` and then check it against
-- either the caller directly OR an active delegate of that approver.
-- ============================================================

create or replace function public.can_act_on_workflow_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  step record;
  requester_dept uuid;
  resolved_approver uuid;
begin
  if public.current_user_role() = 'super_admin' then
    return true;
  end if;

  select * into req from public.workflow_requests where id = p_request_id;
  if req is null or req.status != 'pending' then
    return false;
  end if;

  if req.current_step_override_user_id is not null then
    resolved_approver := req.current_step_override_user_id;
  elsif req.is_escalated then
    -- escalated steps are only actionable by super_admin, already returned
    -- true above for that role - delegation does not apply to an
    -- escalation, which is deliberately a hand-off to the top, not a
    -- normal approver slot
    return false;
  else
    select * into step from public.workflow_steps
      where template_id = req.template_id and position = req.current_step_position;
    if step is null then
      return false;
    end if;

    if step.approver_type = 'specific_user' then
      resolved_approver := step.specific_user_id;
    elsif step.approver_type = 'department_manager' then
      select department_id into requester_dept from public.users where id = req.requested_by;
      select manager_id into resolved_approver from public.departments where id = requester_dept;
    else
      return false; -- approver_type = 'super_admin', already handled above
    end if;
  end if;

  if resolved_approver is null then
    return false;
  end if;

  return resolved_approver = auth.uid() or public.is_active_approval_delegate(resolved_approver, auth.uid());
end;
$$;

-- ============================================================
-- act_on_flow_approval: same delegation check added.
-- ============================================================

create or replace function public.act_on_flow_approval(p_approval_id uuid, p_approved boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appr public.workflow_flow_approvals;
  caller uuid := auth.uid();
  caller_role text := public.current_user_role();
begin
  select * into appr from public.workflow_flow_approvals where id = p_approval_id and status = 'pending';
  if appr is null then
    raise exception 'طلب الموافقة غير موجود أو تم البت فيه مسبقًا';
  end if;

  if not (
    caller_role = 'super_admin'
    or appr.approver_user_id = caller
    or public.is_active_approval_delegate(appr.approver_user_id, caller)
  ) then
    raise exception 'غير مصرح لك بالبت في هذه الموافقة';
  end if;

  update public.workflow_flow_approvals
  set status = case when p_approved then 'approved' else 'rejected' end,
      acted_by = caller, acted_at = now()
  where id = p_approval_id;

  if p_approved then
    insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
    values (appr.execution_id, appr.node_id, 'approval', 'success', coalesce('تمت الموافقة: ' || p_note, 'تمت الموافقة'));
    perform public.advance_past_approval(appr.execution_id, appr.node_id);
  else
    update public.workflow_flow_executions set status = 'rejected', completed_at = now() where id = appr.execution_id;
    insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
    values (appr.execution_id, appr.node_id, 'approval', 'failed', coalesce('تم الرفض: ' || p_note, 'تم الرفض'));
  end if;
end;
$$;

-- ============================================================
-- bulk_approve_workflow_requests: a thin loop over the existing
-- act_on_workflow_request() - each id still gets its own full
-- authorization re-check there, so this cannot approve anything the
-- caller couldn't already approve one at a time. One bad id (already
-- acted on, no longer pending, unauthorized) doesn't abort the rest.
-- ============================================================

create or replace function public.bulk_approve_workflow_requests(p_request_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  foreach rid in array p_request_ids loop
    begin
      perform public.act_on_workflow_request(rid, 'approve', null, null);
    exception when others then
      continue;
    end;
  end loop;
end;
$$;

revoke all on function public.bulk_approve_workflow_requests(uuid[]) from public;
grant execute on function public.bulk_approve_workflow_requests(uuid[]) to authenticated;

-- ============================================================
-- auto-escalation on SLA breach - a pending request past its sla_due_at
-- (set at submission time, request_center.sql) that nobody has acted on
-- gets escalated automatically, the same is_escalated flag a human
-- clicking "تصعيد" would set, so every existing display/authorization
-- path (can_act_on_workflow_request's escalated branch, the step pills UI)
-- already handles it with no further change needed.
-- ============================================================

-- automatic escalation has no human actor - loosen the column rather
-- than invent a fake "system" user row
alter table public.workflow_actions alter column actor_id drop not null;

create or replace function public.escalate_overdue_workflow_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    update public.workflow_requests
    set is_escalated = true
    where status = 'pending' and sla_due_at is not null and sla_due_at < now() and not is_escalated
    returning id, organization_id, title, current_step_position, requested_by
  loop
    insert into public.workflow_actions (request_id, step_position, actor_id, action_type, note)
    values (r.id, r.current_step_position, null, 'escalate', 'تصعيد تلقائي بسبب تجاوز مهلة SLA');

    insert into public.notifications (user_id, type, message)
    select u.id, 'workflow_escalated', 'تم تصعيد الطلب "' || r.title || '" تلقائيًا لتجاوزه مهلة SLA'
    from public.users u
    where u.organization_id = r.organization_id and u.role = 'super_admin';

    insert into public.notifications (user_id, type, message)
    values (r.requested_by, 'workflow_escalated', 'تم تصعيد طلبك "' || r.title || '" للمدير العام لتجاوزه مهلة SLA');
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'escalate-overdue-workflow-requests',
  '*/15 * * * *',
  $$select public.escalate_overdue_workflow_requests()$$
);
