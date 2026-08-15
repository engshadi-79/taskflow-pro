-- MONJEZ 3.0 — P06: Workflow Builder
-- Run after schema.sql, rls.sql, automation_engine.sql, sla_engine.sql.
--
-- Scope decision (agreed explicitly before building this): a REAL but
-- SIMPLIFIED visual builder, not the full 11-node spec in one shot.
-- 7 real node types (trigger/condition/create_task/assign/notification/
-- delay/approval) instead of 11 - "email" and "webhook" are excluded
-- because neither capability exists ANYWHERE in this app yet (confirmed
-- by the P01 audit: zero email integration, zero webhook infrastructure),
-- so a node for either would be a placeholder with nothing real behind
-- it; "create_request" and "update_record" are excluded as open-ended/
-- higher-risk for a first version. Condition nodes DO support real
-- true/false branching (two outgoing edges), not just a linear gate -
-- that's the one part of "visual graph" worth doing properly since it's
-- not meaningfully harder than a fake linear version.
--
-- This does NOT replace or duplicate automation_rules (automation_engine.sql) -
-- that stays exactly as-is for simple one-shot trigger->condition->action
-- rules. This is for multi-step chains that need sequencing, waiting
-- (delay/approval), and branching, which automation_rules structurally
-- cannot express. Both dispatch from the SAME existing trigger functions
-- (dispatch_task_automations/dispatch_project_automations/
-- run_sla_near_breach_automations) - extended in place, not duplicated
-- with new triggers on the same tables.

-- ============================================================
-- workflow_flows: the versioned "recipe". flow_group_id ties every
-- version of "the same flow" together; only one version per group can be
-- both published and active (the one that actually dispatches) at a time.
-- ============================================================

create table public.workflow_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flow_group_id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_active boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workflow_flows_one_active_per_group
  on public.workflow_flows(flow_group_id) where is_active;

create index workflow_flows_organization_id_idx on public.workflow_flows(organization_id);

create table public.workflow_flow_nodes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workflow_flows(id) on delete cascade,
  node_type text not null check (node_type in (
    'trigger', 'condition', 'create_task', 'assign', 'notification', 'delay', 'approval'
  )),
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workflow_flow_nodes_flow_id_idx on public.workflow_flow_nodes(flow_id);

create table public.workflow_flow_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workflow_flows(id) on delete cascade,
  from_node_id uuid not null references public.workflow_flow_nodes(id) on delete cascade,
  to_node_id uuid not null references public.workflow_flow_nodes(id) on delete cascade,
  -- null for any non-condition source node (exactly one outgoing edge);
  -- 'true'/'false' for a condition node's two branches
  condition_branch text check (condition_branch in ('true', 'false'))
);

create index workflow_flow_edges_flow_id_idx on public.workflow_flow_edges(flow_id);
create index workflow_flow_edges_from_node_id_idx on public.workflow_flow_edges(from_node_id);

-- ============================================================
-- execution state. status also carries 'retry_pending' - a failed node
-- retries a few times (backed off, via the same cron that resumes a
-- 'delay' node) before finally being marked 'failed'.
-- ============================================================

create table public.workflow_flow_executions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workflow_flows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'project')),
  entity_id uuid not null,
  status text not null default 'running' check (status in (
    'running', 'waiting_delay', 'waiting_approval', 'retry_pending', 'completed', 'failed', 'rejected'
  )),
  current_node_id uuid references public.workflow_flow_nodes(id) on delete set null,
  resume_at timestamptz,
  retry_count int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (flow_id, entity_id)
);

create index workflow_flow_executions_resume_idx
  on public.workflow_flow_executions(resume_at)
  where status in ('waiting_delay', 'retry_pending');

create table public.workflow_flow_execution_logs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.workflow_flow_executions(id) on delete cascade,
  node_id uuid references public.workflow_flow_nodes(id) on delete set null,
  node_type text,
  result text not null check (result in ('success', 'failed', 'waiting')),
  detail text,
  created_at timestamptz not null default now()
);

create index workflow_flow_execution_logs_execution_id_idx on public.workflow_flow_execution_logs(execution_id);

create table public.workflow_flow_approvals (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.workflow_flow_executions(id) on delete cascade,
  node_id uuid not null references public.workflow_flow_nodes(id) on delete cascade,
  approver_type text not null check (approver_type in ('department_manager', 'specific_user')),
  approver_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  acted_by uuid references public.users(id) on delete set null,
  acted_at timestamptz,
  timeout_at timestamptz,
  created_at timestamptz not null default now()
);

create index workflow_flow_approvals_approver_idx on public.workflow_flow_approvals(approver_user_id) where status = 'pending';

-- ============================================================
-- RLS. Flows/nodes/edges: any org member can view (matches
-- automation_rules_select's existing precedent), only super_admin writes.
-- Executions/logs: ops surface, super_admin only (matches
-- automation_executions_select exactly) - no client write policy on
-- either, only the SECURITY DEFINER functions below ever write them.
-- Approvals: the assigned approver must see their own pending item too,
-- not just super_admin.
-- ============================================================

alter table public.workflow_flows enable row level security;
alter table public.workflow_flow_nodes enable row level security;
alter table public.workflow_flow_edges enable row level security;
alter table public.workflow_flow_executions enable row level security;
alter table public.workflow_flow_execution_logs enable row level security;
alter table public.workflow_flow_approvals enable row level security;

create policy workflow_flows_select on public.workflow_flows
  for select using (organization_id = public.current_org_id());

create policy workflow_flows_write on public.workflow_flows
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy workflow_flow_nodes_select on public.workflow_flow_nodes
  for select using (exists (select 1 from public.workflow_flows f where f.id = flow_id));

create policy workflow_flow_nodes_write on public.workflow_flow_nodes
  for all using (
    public.current_user_role() = 'super_admin'
    and exists (select 1 from public.workflow_flows f where f.id = flow_id and f.organization_id = public.current_org_id())
  );

create policy workflow_flow_edges_select on public.workflow_flow_edges
  for select using (exists (select 1 from public.workflow_flows f where f.id = flow_id));

create policy workflow_flow_edges_write on public.workflow_flow_edges
  for all using (
    public.current_user_role() = 'super_admin'
    and exists (select 1 from public.workflow_flows f where f.id = flow_id and f.organization_id = public.current_org_id())
  );

create policy workflow_flow_executions_select on public.workflow_flow_executions
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy workflow_flow_execution_logs_select on public.workflow_flow_execution_logs
  for select using (
    public.current_user_role() = 'super_admin'
    and exists (select 1 from public.workflow_flow_executions e where e.id = execution_id)
  );

create policy workflow_flow_approvals_select on public.workflow_flow_approvals
  for select using (
    approver_user_id = auth.uid()
    or (
      public.current_user_role() = 'super_admin'
      and exists (
        select 1 from public.workflow_flow_executions e
        where e.id = execution_id and e.organization_id = public.current_org_id()
      )
    )
  );

-- ============================================================
-- advance_flow_execution: the interpreter. Walks one node, executes its
-- effect, logs the result, and recurses into the next node - so a chain
-- of non-blocking nodes (create_task -> notification -> assign) all run
-- in one pass, stopping only at a real wait point (delay/approval), a
-- dead end (no outgoing edge -> completed), or a failure.
--
-- p_depth guards against a cyclic graph the canvas shouldn't allow but
-- could - 50 hops is far more than any real flow needs.
-- ============================================================

create or replace function public.advance_flow_execution(p_execution_id uuid, p_depth int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exec public.workflow_flow_executions;
  node public.workflow_flow_nodes;
  task_row public.tasks;
  cond_field text;
  cond_operator text;
  cond_value text;
  actual_value text;
  cond_result boolean;
  next_edge public.workflow_flow_edges;
  target_user uuid;
  requester_dept uuid;
begin
  if p_depth > 50 then
    update public.workflow_flow_executions set status = 'failed', completed_at = now() where id = p_execution_id;
    insert into public.workflow_flow_execution_logs (execution_id, result, detail)
    values (p_execution_id, 'failed', 'تجاوز الحد الأقصى لعدد الخطوات المتسلسلة (احتمال حلقة في الرسم)');
    return;
  end if;

  select * into exec from public.workflow_flow_executions where id = p_execution_id;
  if exec is null or exec.status not in ('running') then
    return;
  end if;

  select * into node from public.workflow_flow_nodes where id = exec.current_node_id;
  if node is null then
    update public.workflow_flow_executions set status = 'completed', completed_at = now() where id = p_execution_id;
    return;
  end if;

  if exec.entity_type = 'task' then
    select * into task_row from public.tasks where id = exec.entity_id;
  end if;

  begin
    if node.node_type = 'condition' then
      cond_field := node.config ->> 'field';
      cond_operator := coalesce(node.config ->> 'operator', 'eq');
      cond_value := node.config ->> 'value';
      actual_value := case cond_field
        when 'priority' then task_row.priority
        when 'status' then task_row.status
        else null
      end;
      cond_result := case cond_operator
        when 'neq' then actual_value is distinct from cond_value
        else actual_value = cond_value
      end;

      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
      values (p_execution_id, node.id, node.node_type, 'success', 'نتيجة الشرط: ' || coalesce(cond_result::text, 'غير معروف'));

      select * into next_edge from public.workflow_flow_edges
        where from_node_id = node.id and condition_branch = (case when cond_result then 'true' else 'false' end)
        limit 1;

    elsif node.node_type = 'create_task' then
      insert into public.tasks (organization_id, title, assigned_to, created_by, priority, status)
      values (
        exec.organization_id,
        coalesce(node.config ->> 'title', 'مهمة من سير عمل تلقائي'),
        coalesce(nullif(node.config ->> 'assign_to', '')::uuid, task_row.assigned_to),
        task_row.created_by,
        coalesce(node.config ->> 'priority', 'medium'),
        'new'
      );
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result)
      values (p_execution_id, node.id, node.node_type, 'success');

      select * into next_edge from public.workflow_flow_edges where from_node_id = node.id limit 1;

    elsif node.node_type = 'assign' then
      select department_id into requester_dept from public.users where id = task_row.assigned_to;
      target_user := case node.config ->> 'assign_to'
        when 'department_manager' then (select manager_id from public.departments where id = requester_dept)
        else nullif(node.config ->> 'assign_to', '')::uuid
      end;
      if target_user is not null and task_row.id is not null then
        update public.tasks set assigned_to = target_user where id = task_row.id;
      end if;
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result)
      values (p_execution_id, node.id, node.node_type, 'success');

      select * into next_edge from public.workflow_flow_edges where from_node_id = node.id limit 1;

    elsif node.node_type = 'notification' then
      select department_id into requester_dept from public.users where id = task_row.assigned_to;
      target_user := case node.config ->> 'target'
        when 'trigger_actor' then task_row.assigned_to
        when 'department_manager' then (select manager_id from public.departments where id = requester_dept)
        else nullif(node.config ->> 'target', '')::uuid
      end;
      if target_user is not null then
        insert into public.notifications (user_id, task_id, type, message)
        values (target_user, task_row.id, 'automation', coalesce(node.config ->> 'message', 'إشعار من سير عمل تلقائي'));
      end if;
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result)
      values (p_execution_id, node.id, node.node_type, 'success');

      select * into next_edge from public.workflow_flow_edges where from_node_id = node.id limit 1;

    elsif node.node_type = 'delay' then
      update public.workflow_flow_executions
        set status = 'waiting_delay',
            resume_at = now() + (coalesce((node.config ->> 'hours')::numeric, 1) || ' hours')::interval
        where id = p_execution_id;
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
      values (p_execution_id, node.id, node.node_type, 'waiting', 'مؤجَّل حتى الوقت المحدَّد');
      return;

    elsif node.node_type = 'approval' then
      select department_id into requester_dept from public.users where id = task_row.assigned_to;
      target_user := case node.config ->> 'approver_type'
        when 'specific_user' then nullif(node.config ->> 'approver_user_id', '')::uuid
        else (select manager_id from public.departments where id = requester_dept)
      end;

      insert into public.workflow_flow_approvals (execution_id, node_id, approver_type, approver_user_id, timeout_at)
      values (
        p_execution_id, node.id, coalesce(node.config ->> 'approver_type', 'department_manager'), target_user,
        now() + interval '72 hours'
      );

      update public.workflow_flow_executions set status = 'waiting_approval' where id = p_execution_id;
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
      values (p_execution_id, node.id, node.node_type, 'waiting', 'بانتظار الموافقة');
      return;
    end if;

  exception
    when others then
      update public.workflow_flow_executions
        set retry_count = retry_count + 1,
            status = case when retry_count + 1 >= 3 then 'failed' else 'retry_pending' end,
            resume_at = case when retry_count + 1 >= 3 then null else now() + interval '5 minutes' end,
            completed_at = case when retry_count + 1 >= 3 then now() else null end
        where id = p_execution_id;
      insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
      values (p_execution_id, node.id, node.node_type, 'failed', sqlerrm);
      return;
  end;

  if next_edge.id is null then
    update public.workflow_flow_executions set status = 'completed', completed_at = now() where id = p_execution_id;
  else
    update public.workflow_flow_executions set current_node_id = next_edge.to_node_id where id = p_execution_id;
    perform public.advance_flow_execution(p_execution_id, p_depth + 1);
  end if;
end;
$$;

-- ============================================================
-- dispatch_flow_executions: mirrors run_automation_rules' shape/dedupe
-- philosophy exactly (unique (flow_id, entity_id) means a given flow
-- runs at most once ever per entity), called from the SAME existing
-- trigger points automation_rules already uses.
-- ============================================================

create or replace function public.dispatch_flow_executions(
  p_trigger_event text,
  p_entity_type text,
  p_entity_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  flow record;
  first_node_id uuid;
  new_execution_id uuid;
begin
  for flow in
    select f.id from public.workflow_flows f
    join public.workflow_flow_nodes n on n.flow_id = f.id and n.node_type = 'trigger'
    where f.organization_id = p_organization_id
      and f.status = 'published'
      and f.is_active
      and (n.config ->> 'event') = p_trigger_event
  loop
    if exists (
      select 1 from public.workflow_flow_executions
      where flow_id = flow.id and entity_id = p_entity_id
    ) then
      continue;
    end if;

    select e.to_node_id into first_node_id
    from public.workflow_flow_nodes n
    join public.workflow_flow_edges e on e.from_node_id = n.id
    where n.flow_id = flow.id and n.node_type = 'trigger'
    limit 1;

    if first_node_id is null then
      continue;
    end if;

    begin
      insert into public.workflow_flow_executions (flow_id, organization_id, entity_type, entity_id, status, current_node_id)
      values (flow.id, p_organization_id, p_entity_type, p_entity_id, 'running', first_node_id)
      returning id into new_execution_id;
    exception
      when unique_violation then
        continue;
    end;

    perform public.advance_flow_execution(new_execution_id);
  end loop;
end;
$$;

-- extend the EXISTING dispatch triggers in place - no new triggers added
-- on tasks/projects, this app already has exactly one trigger per table
-- for event-based automation and that stays true
create or replace function public.dispatch_task_automations()
returns trigger
language plpgsql
as $$
declare
  ctx jsonb;
begin
  ctx := jsonb_build_object(
    'status', new.status,
    'priority', new.priority,
    'assigned_to', new.assigned_to,
    'project_id', new.project_id
  );

  if TG_OP = 'INSERT' then
    perform public.run_automation_rules('task_created', 'task', new.id, new.organization_id, ctx);
    perform public.dispatch_flow_executions('task_created', 'task', new.id, new.organization_id);
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    perform public.run_automation_rules('task_status_changed', 'task', new.id, new.organization_id, ctx);
    perform public.dispatch_flow_executions('task_status_changed', 'task', new.id, new.organization_id);
    if new.status = 'overdue' then
      perform public.run_automation_rules('task_overdue', 'task', new.id, new.organization_id, ctx);
      perform public.dispatch_flow_executions('task_overdue', 'task', new.id, new.organization_id);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.dispatch_project_automations()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
    perform public.run_automation_rules(
      'project_completed', 'project', new.id, new.organization_id,
      jsonb_build_object('status', new.status)
    );
    perform public.dispatch_flow_executions('project_completed', 'project', new.id, new.organization_id);
  end if;
  return new;
end;
$$;

create or replace function public.run_sla_near_breach_automations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select tsk.id, tsk.organization_id, tsk.status, tsk.priority, tsk.assigned_to, tsk.project_id
    from public.tasks tsk
    join public.sla_policies p on p.organization_id = tsk.organization_id and p.priority = tsk.priority and p.is_active
    where tsk.status not in ('completed', 'cancelled')
      and now() > tsk.created_at + (p.resolution_minutes || ' minutes')::interval * 0.8
      and now() <= tsk.created_at + (p.resolution_minutes || ' minutes')::interval
  loop
    perform public.run_automation_rules(
      'sla_near_breach', 'task', t.id, t.organization_id,
      jsonb_build_object('status', t.status, 'priority', t.priority, 'assigned_to', t.assigned_to, 'project_id', t.project_id)
    );
    perform public.dispatch_flow_executions('sla_near_breach', 'task', t.id, t.organization_id);
  end loop;
end;
$$;

-- ============================================================
-- resume waiting (delay) and retry-pending executions - one shared cron,
-- since both are "an execution parked with a resume_at that has now arrived"
-- ============================================================

create or replace function public.resume_flow_executions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ex record;
begin
  for ex in
    select id from public.workflow_flow_executions
    where status in ('waiting_delay', 'retry_pending') and resume_at is not null and resume_at <= now()
  loop
    update public.workflow_flow_executions set status = 'running', resume_at = null where id = ex.id;
    perform public.advance_flow_execution(ex.id);
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'resume-flow-executions',
  '*/15 * * * *',
  $$select public.resume_flow_executions()$$
);

create or replace function public.timeout_pending_flow_approvals()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appr record;
begin
  for appr in
    select * from public.workflow_flow_approvals
    where status = 'pending' and timeout_at is not null and timeout_at < now()
  loop
    update public.workflow_flow_approvals set status = 'rejected', acted_at = now() where id = appr.id;
    update public.workflow_flow_executions set status = 'failed', completed_at = now() where id = appr.execution_id;
    insert into public.workflow_flow_execution_logs (execution_id, node_id, node_type, result, detail)
    values (appr.execution_id, appr.node_id, 'approval', 'failed', 'انتهت مهلة الموافقة دون رد (Timeout)');
  end loop;
end;
$$;

select cron.schedule(
  'timeout-pending-flow-approvals',
  '*/15 * * * *',
  $$select public.timeout_pending_flow_approvals()$$
);

-- ============================================================
-- act_on_flow_approval: the only way a pending approval is ever resolved.
-- ============================================================

create or replace function public.advance_past_approval(p_execution_id uuid, p_approval_node_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_edge public.workflow_flow_edges;
begin
  select * into next_edge from public.workflow_flow_edges where from_node_id = p_approval_node_id limit 1;
  if next_edge.id is null then
    update public.workflow_flow_executions set status = 'completed', completed_at = now() where id = p_execution_id;
  else
    update public.workflow_flow_executions set current_node_id = next_edge.to_node_id where id = p_execution_id;
    perform public.advance_flow_execution(p_execution_id);
  end if;
end;
$$;

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

  if not (caller_role = 'super_admin' or appr.approver_user_id = caller) then
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

revoke all on function public.act_on_flow_approval(uuid, boolean, text) from public;
grant execute on function public.act_on_flow_approval(uuid, boolean, text) to authenticated;

-- ============================================================
-- run_flow_test: manually trigger a published+active flow against a
-- specific entity, for a super_admin to verify a flow behaves as designed
-- before relying on it to fire from real events. Uses the exact same
-- dispatch/advance path as a real trigger - no separate "simulation" code
-- path to keep in sync.
-- ============================================================

create or replace function public.run_flow_test(p_flow_id uuid, p_entity_type text, p_entity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  flow public.workflow_flows;
  first_node_id uuid;
  new_execution_id uuid;
  org uuid := public.current_org_id();
begin
  if public.current_user_role() != 'super_admin' then
    raise exception 'غير مصرح لك بتشغيل اختبار على سير العمل';
  end if;

  select * into flow from public.workflow_flows where id = p_flow_id and organization_id = org;
  if flow is null then
    raise exception 'سير العمل غير موجود';
  end if;

  if p_entity_type = 'task' and not exists (
    select 1 from public.tasks where id = p_entity_id and organization_id = org
  ) then
    raise exception 'المهمة المحدَّدة غير موجودة في مؤسستك';
  elsif p_entity_type = 'project' and not exists (
    select 1 from public.projects where id = p_entity_id and organization_id = org
  ) then
    raise exception 'المشروع المحدَّد غير موجود في مؤسستك';
  end if;

  select e.to_node_id into first_node_id
  from public.workflow_flow_nodes n
  join public.workflow_flow_edges e on e.from_node_id = n.id
  where n.flow_id = p_flow_id and n.node_type = 'trigger'
  limit 1;

  if first_node_id is null then
    raise exception 'لا توجد خطوة متصلة بعقدة البداية';
  end if;

  insert into public.workflow_flow_executions (flow_id, organization_id, entity_type, entity_id, status, current_node_id)
  values (p_flow_id, org, p_entity_type, p_entity_id, 'running', first_node_id)
  returning id into new_execution_id;

  perform public.advance_flow_execution(new_execution_id);

  return new_execution_id;
end;
$$;

revoke all on function public.run_flow_test(uuid, text, uuid) from public;
grant execute on function public.run_flow_test(uuid, text, uuid) to authenticated;

-- ============================================================
-- publish_flow_version: turns a draft into the active published version,
-- deactivating whatever was previously active for the same flow_group_id
-- (the unique index above only allows one active row per group, so this
-- has to happen in one statement/transaction, not two separate updates a
-- client could interleave with something else).
-- ============================================================

create or replace function public.publish_flow_version(p_flow_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  flow public.workflow_flows;
begin
  if public.current_user_role() != 'super_admin' then
    raise exception 'غير مصرح لك بنشر سير العمل';
  end if;

  select * into flow from public.workflow_flows where id = p_flow_id and organization_id = public.current_org_id();
  if flow is null then
    raise exception 'سير العمل غير موجود';
  end if;

  update public.workflow_flows set is_active = false
  where flow_group_id = flow.flow_group_id and is_active;

  update public.workflow_flows set status = 'published', is_active = true, updated_at = now()
  where id = p_flow_id;
end;
$$;

revoke all on function public.publish_flow_version(uuid) from public;
grant execute on function public.publish_flow_version(uuid) to authenticated;

-- ============================================================
-- create_workflow_flow: a brand new flow starts as a draft with just its
-- trigger node - everything else is added on the canvas afterward via
-- plain RLS-gated inserts on workflow_flow_nodes/workflow_flow_edges
-- (super_admin already has direct write access to both), no RPC wrapper
-- needed for ordinary node/edge editing.
-- ============================================================

create or replace function public.create_workflow_flow(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if public.current_user_role() != 'super_admin' then
    raise exception 'غير مصرح لك بإنشاء سير عمل جديد';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'اسم سير العمل مطلوب';
  end if;

  insert into public.workflow_flows (organization_id, name, description, created_by)
  values (public.current_org_id(), trim(p_name), p_description, auth.uid())
  returning id into new_id;

  insert into public.workflow_flow_nodes (flow_id, node_type, position_x, position_y, config)
  values (new_id, 'trigger', 60, 200, '{}'::jsonb);

  return new_id;
end;
$$;

revoke all on function public.create_workflow_flow(text, text) from public;
grant execute on function public.create_workflow_flow(text, text) to authenticated;

-- ============================================================
-- create_flow_version: clones an existing flow (with all its nodes/edges)
-- into a new draft row sharing the same flow_group_id - "save a new
-- version" without losing the published one still running.
-- ============================================================

create or replace function public.create_flow_version(p_flow_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.workflow_flows;
  new_id uuid;
  next_version int;
  node_map jsonb := '{}'::jsonb;
  n record;
  new_node_id uuid;
  e record;
begin
  if public.current_user_role() != 'super_admin' then
    raise exception 'غير مصرح لك بإنشاء نسخة جديدة';
  end if;

  select * into src from public.workflow_flows where id = p_flow_id and organization_id = public.current_org_id();
  if src is null then
    raise exception 'سير العمل غير موجود';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
    from public.workflow_flows where flow_group_id = src.flow_group_id;

  insert into public.workflow_flows (organization_id, flow_group_id, name, description, version, status, is_active, created_by)
  values (src.organization_id, src.flow_group_id, src.name, src.description, next_version, 'draft', false, auth.uid())
  returning id into new_id;

  for n in select * from public.workflow_flow_nodes where flow_id = p_flow_id loop
    insert into public.workflow_flow_nodes (flow_id, node_type, position_x, position_y, config)
    values (new_id, n.node_type, n.position_x, n.position_y, n.config)
    returning id into new_node_id;
    node_map := node_map || jsonb_build_object(n.id::text, new_node_id::text);
  end loop;

  for e in select * from public.workflow_flow_edges where flow_id = p_flow_id loop
    insert into public.workflow_flow_edges (flow_id, from_node_id, to_node_id, condition_branch)
    values (
      new_id,
      (node_map ->> e.from_node_id::text)::uuid,
      (node_map ->> e.to_node_id::text)::uuid,
      e.condition_branch
    );
  end loop;

  return new_id;
end;
$$;

revoke all on function public.create_flow_version(uuid) from public;
grant execute on function public.create_flow_version(uuid) to authenticated;
