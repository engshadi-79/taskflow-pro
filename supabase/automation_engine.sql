-- TaskFlow Pro (MONJEZ 2.0) — Phase 10: Automation Engine
-- Run after projects_foundation.sql and sla_engine.sql (the sla_near_breach
-- trigger reuses sla_policies).
--
-- One generic Trigger -> Condition -> Action engine, not five hardcoded
-- behaviours - the plan's five examples (task_created/task_overdue/
-- task_completed/sla_near_breach/project_completed) are just the
-- trigger_event values an admin can pick when defining a rule, and any
-- number of rules can exist per event. Actions never run from the client -
-- every rule fires from a database trigger (tasks/projects) or the
-- existing pg_cron job pattern (sla_near_breach is time-based, not
-- event-based, so it's polled the same way notify_sla_breaches() already is).

-- ============================================================
-- automation_rules + automation_executions (the execution log AND the
-- dedupe mechanism - a unique constraint, not just an app-side check, so a
-- race between two concurrent trigger firings still can't double-run a rule)
-- ============================================================
create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_event text not null check (trigger_event in (
    'task_created', 'task_status_changed', 'task_overdue', 'sla_near_breach', 'project_completed'
  )),
  -- simple key/value equality filters, checked against the trigger's own
  -- context (e.g. {"priority": "urgent"} only fires for urgent tasks)
  conditions jsonb,
  action_type text not null check (action_type in (
    'notify_assignee', 'notify_creator', 'notify_department_manager', 'notify_project_manager',
    'notify_specific_user', 'change_status', 'change_priority', 'create_followup_task', 'reassign'
  )),
  action_params jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'project')),
  entity_id uuid not null,
  result text not null check (result in ('success', 'error')),
  detail text,
  executed_at timestamptz not null default now(),
  unique (rule_id, entity_id)
);

create index automation_rules_organization_id_idx on public.automation_rules(organization_id);
create index automation_rules_trigger_event_idx on public.automation_rules(trigger_event);
create index automation_executions_rule_id_idx on public.automation_executions(rule_id);

alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;

create policy automation_rules_select on public.automation_rules
  for select using (organization_id = public.current_org_id());

create policy automation_rules_write on public.automation_rules
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- execution log is an ops/audit surface - super_admin only, no client-side
-- insert/update/delete policy at all (only run_automation_rules(), a
-- SECURITY DEFINER function, ever writes to it)
create policy automation_executions_select on public.automation_executions
  for select using (public.current_user_role() = 'super_admin');

-- ============================================================
-- execute_automation_action: performs one rule's effect. Every branch is a
-- real, existing capability (notifications table, tasks.status/priority/
-- assigned_to, or inserting a plain new task) - nothing here is a stub.
-- ============================================================
create function public.execute_automation_action(
  p_rule public.automation_rules,
  p_entity_type text,
  p_entity_id uuid,
  p_context jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  task_row public.tasks;
begin
  if p_entity_type = 'task' then
    select * into task_row from public.tasks where id = p_entity_id;
  end if;

  if p_rule.action_type = 'notify_assignee' and task_row.id is not null then
    insert into public.notifications (user_id, task_id, type, message)
    values (task_row.assigned_to, task_row.id, 'automation', 'إشعار تلقائي (' || p_rule.name || '): ' || task_row.title);

  elsif p_rule.action_type = 'notify_creator' and task_row.id is not null and task_row.created_by is not null then
    insert into public.notifications (user_id, task_id, type, message)
    values (task_row.created_by, task_row.id, 'automation', 'إشعار تلقائي (' || p_rule.name || '): ' || task_row.title);

  elsif p_rule.action_type = 'notify_department_manager' and task_row.id is not null then
    select d.manager_id into target_user
    from public.users u join public.departments d on d.id = u.department_id
    where u.id = task_row.assigned_to;
    if target_user is not null then
      insert into public.notifications (user_id, task_id, type, message)
      values (target_user, task_row.id, 'automation', 'إشعار تلقائي (' || p_rule.name || '): ' || task_row.title);
    end if;

  elsif p_rule.action_type = 'notify_project_manager' then
    if p_entity_type = 'project' then
      select manager_id into target_user from public.projects where id = p_entity_id;
    elsif task_row.project_id is not null then
      select manager_id into target_user from public.projects where id = task_row.project_id;
    end if;
    if target_user is not null then
      insert into public.notifications (user_id, task_id, type, message)
      values (target_user, task_row.id, 'automation', 'إشعار تلقائي: ' || p_rule.name);
    end if;

  elsif p_rule.action_type = 'notify_specific_user' then
    target_user := (p_rule.action_params ->> 'user_id')::uuid;
    if target_user is not null then
      insert into public.notifications (user_id, task_id, type, message)
      values (target_user, task_row.id, 'automation', 'إشعار تلقائي: ' || p_rule.name);
    end if;

  elsif p_rule.action_type = 'change_status' and task_row.id is not null then
    update public.tasks set status = (p_rule.action_params ->> 'status') where id = task_row.id;

  elsif p_rule.action_type = 'change_priority' and task_row.id is not null then
    update public.tasks set priority = (p_rule.action_params ->> 'priority') where id = task_row.id;

  elsif p_rule.action_type = 'create_followup_task' and task_row.id is not null then
    insert into public.tasks (organization_id, title, assigned_to, created_by, priority, status, project_id)
    values (
      task_row.organization_id,
      coalesce(p_rule.action_params ->> 'title', 'متابعة: ' || task_row.title),
      coalesce((p_rule.action_params ->> 'assigned_to')::uuid, task_row.assigned_to),
      task_row.created_by,
      coalesce(p_rule.action_params ->> 'priority', 'medium'),
      'new',
      task_row.project_id
    );

  elsif p_rule.action_type = 'reassign' and task_row.id is not null then
    target_user := (p_rule.action_params ->> 'user_id')::uuid;
    if target_user is not null then
      update public.tasks set assigned_to = target_user where id = task_row.id;
    end if;
  end if;
end;
$$;

-- ============================================================
-- run_automation_rules: the dispatcher every trigger/cron job below calls.
-- Per-rule exception handling means one broken rule can't block the rest
-- from running, and a unique_violation on automation_executions (a
-- concurrent duplicate firing) is treated as "already done", not an error.
-- ============================================================
create function public.run_automation_rules(
  p_trigger_event text,
  p_entity_type text,
  p_entity_id uuid,
  p_organization_id uuid,
  p_context jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
  matches boolean;
  cond_key text;
begin
  for rule in
    select * from public.automation_rules
    where organization_id = p_organization_id
      and trigger_event = p_trigger_event
      and is_active
  loop
    if exists (
      select 1 from public.automation_executions
      where rule_id = rule.id and entity_id = p_entity_id
    ) then
      continue;
    end if;

    matches := true;
    if rule.conditions is not null then
      for cond_key in select jsonb_object_keys(rule.conditions) loop
        if (rule.conditions ->> cond_key) is distinct from (p_context ->> cond_key) then
          matches := false;
          exit;
        end if;
      end loop;
    end if;

    if not matches then
      continue;
    end if;

    begin
      perform public.execute_automation_action(rule, p_entity_type, p_entity_id, p_context);
      insert into public.automation_executions (rule_id, entity_type, entity_id, result)
      values (rule.id, p_entity_type, p_entity_id, 'success');
    exception
      when unique_violation then
        null;
      when others then
        insert into public.automation_executions (rule_id, entity_type, entity_id, result, detail)
        values (rule.id, p_entity_type, p_entity_id, 'error', sqlerrm)
        on conflict (rule_id, entity_id) do nothing;
    end;
  end loop;
end;
$$;

-- ============================================================
-- event-based triggers. Actions like change_status/reassign write back to
-- the same tasks row via a fresh UPDATE statement (not by mutating NEW in
-- place), which fires this same trigger again for that new change - safe
-- by construction, because the unique (rule_id, entity_id) dedupe means
-- that specific rule can never re-fire for this task again, so the
-- recursion always terminates once every matching rule has run exactly once.
-- ============================================================
create function public.dispatch_task_automations()
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
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    perform public.run_automation_rules('task_status_changed', 'task', new.id, new.organization_id, ctx);
    if new.status = 'overdue' then
      perform public.run_automation_rules('task_overdue', 'task', new.id, new.organization_id, ctx);
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_dispatch_automations
  after insert or update on public.tasks
  for each row execute function public.dispatch_task_automations();

create function public.dispatch_project_automations()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
    perform public.run_automation_rules(
      'project_completed', 'project', new.id, new.organization_id,
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger projects_dispatch_automations
  after update on public.projects
  for each row execute function public.dispatch_project_automations();

-- ============================================================
-- sla_near_breach: time-based, so it's polled by cron rather than fired by
-- a row-level trigger - same reasoning as send_due_date_reminders()/
-- notify_sla_breaches() already being cron jobs, not triggers.
-- ============================================================
create function public.run_sla_near_breach_automations()
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
  end loop;
end;
$$;

select cron.schedule(
  'run-sla-near-breach-automations',
  '*/15 * * * *',
  $$select public.run_sla_near_breach_automations()$$
);
