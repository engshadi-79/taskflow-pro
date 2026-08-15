-- MONJEZ 3.0 P11 — Automation Center
-- Extends automation_engine.sql (MONJEZ 2.0 P10) with the two gaps recorded
-- in PROJECT(3).md: automatic retry on failure, and a template gallery so a
-- rule doesn't have to be built field-by-field from scratch every time.

-- ============================================================
-- 1) Automatic retry: same state machine already used by
--    workflow_flow_executions (retry_count/resume_at/'retry_pending'/'failed'),
--    applied to automation_executions instead of adding a parallel table.
--    The existing unique (rule_id, entity_id) constraint means a single row
--    can be updated in place across attempts rather than inserting a new one
--    each time.
-- ============================================================

alter table public.automation_executions drop constraint automation_executions_result_check;
alter table public.automation_executions
  add constraint automation_executions_result_check
  check (result in ('success', 'error', 'retry_pending', 'failed'));

alter table public.automation_executions
  add column if not exists attempt_count int not null default 1,
  add column if not exists next_retry_at timestamptz;

create index if not exists automation_executions_retry_idx
  on public.automation_executions (next_retry_at)
  where result = 'retry_pending';

-- One-time backfill: historical failures logged before retry existed get one
-- real shot at succeeding instead of staying permanently dead.
update public.automation_executions
set result = 'retry_pending', next_retry_at = now()
where result = 'error' and next_retry_at is null;

-- First failure now becomes retryable instead of a dead-end 'error' row.
-- Everything else in this function (dedupe check, condition matching,
-- unique_violation handling) is unchanged from automation_engine.sql.
create or replace function public.run_automation_rules(
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
        insert into public.automation_executions (rule_id, entity_type, entity_id, result, detail, next_retry_at)
        values (rule.id, p_entity_type, p_entity_id, 'retry_pending', sqlerrm, now() + interval '5 minutes')
        on conflict (rule_id, entity_id) do nothing;
    end;
  end loop;
end;
$$;

-- Bounded sweep, same cadence/shape as run_sla_near_breach_automations() and
-- workflow_builder.sql's resume_flow_executions(): up to 3 attempts total,
-- 5-minute fixed backoff, terminal 'failed' state after that. execute_automation_action
-- never reads p_context, so no context needs to be persisted for a retry.
create or replace function public.retry_failed_automations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ex record;
  rule public.automation_rules;
begin
  for ex in
    select * from public.automation_executions
    where result = 'retry_pending' and next_retry_at is not null and next_retry_at <= now()
    order by next_retry_at
    limit 50
  loop
    select * into rule from public.automation_rules where id = ex.rule_id and is_active;

    if rule.id is null then
      update public.automation_executions
        set result = 'failed', next_retry_at = null,
            detail = coalesce(detail, '') || ' (القاعدة معطّلة أو محذوفة)'
        where id = ex.id;
      continue;
    end if;

    begin
      perform public.execute_automation_action(rule, ex.entity_type, ex.entity_id, '{}'::jsonb);
      update public.automation_executions
        set result = 'success', next_retry_at = null, executed_at = now()
        where id = ex.id;
    exception
      when others then
        update public.automation_executions
          set attempt_count = ex.attempt_count + 1,
              detail = sqlerrm,
              executed_at = now(),
              result = case when ex.attempt_count + 1 >= 3 then 'failed' else 'retry_pending' end,
              next_retry_at = case when ex.attempt_count + 1 >= 3 then null else now() + interval '5 minutes' end
          where id = ex.id;
    end;
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'retry-failed-automations',
  '*/15 * * * *',
  $$select public.retry_failed_automations()$$
);

-- ============================================================
-- 2) Template gallery: same "seed for existing orgs + trigger for future
--    orgs" convention as seed_default_request_templates() in request_center.sql
--    (itself modeled on P02's role_permissions seeding). Limited to action
--    types that don't require picking a specific person (notify_specific_user/
--    reassign stay custom-only - a template can't pre-fill "which employee").
-- ============================================================

create table public.automation_rule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger_event text not null check (trigger_event in (
    'task_created', 'task_status_changed', 'task_overdue', 'sla_near_breach', 'project_completed'
  )),
  conditions jsonb,
  action_type text not null check (action_type in (
    'notify_assignee', 'notify_creator', 'notify_department_manager', 'notify_project_manager',
    'notify_specific_user', 'change_status', 'change_priority', 'create_followup_task', 'reassign'
  )),
  action_params jsonb,
  created_at timestamptz not null default now()
);

create index automation_rule_templates_organization_id_idx on public.automation_rule_templates(organization_id);

alter table public.automation_rule_templates enable row level security;

-- read-only from the client on purpose - no insert/update/delete policy;
-- only seed_default_automation_templates() (SECURITY DEFINER) ever writes here.
create policy automation_rule_templates_select on public.automation_rule_templates
  for select using (organization_id = public.current_org_id());

create or replace function public.seed_default_automation_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.automation_rule_templates
    (organization_id, name, description, trigger_event, conditions, action_type, action_params)
  values
    (p_org_id, 'تنبيه عند إنشاء مهمة عاجلة',
     'يُخطر مدير القسم فور إنشاء أي مهمة بأولوية عاجلة',
     'task_created', '{"priority": "urgent"}'::jsonb, 'notify_department_manager', null),

    (p_org_id, 'تنبيه المسؤول عند تغيّر حالة المهمة',
     'يُخطر الموظف المسؤول عن المهمة كلما تغيّرت حالتها',
     'task_status_changed', null, 'notify_assignee', null),

    (p_org_id, 'تصعيد المهام المتأخرة لمدير القسم',
     'يُخطر مدير القسم فور تأخّر أي مهمة عن موعدها',
     'task_overdue', null, 'notify_department_manager', null),

    (p_org_id, 'رفع أولوية المهام المتأخرة تلقائيًا',
     'يرفع أولوية أي مهمة متأخرة إلى "عاجلة" لتسريع معالجتها',
     'task_overdue', null, 'change_priority', '{"priority": "urgent"}'::jsonb),

    (p_org_id, 'تنبيه مبكر عند اقتراب انتهاء SLA',
     'يُخطر المسؤول عن المهمة عند بلوغها 80٪ من مهلة اتفاقية مستوى الخدمة',
     'sla_near_breach', null, 'notify_assignee', null),

    (p_org_id, 'تنبيه مدير المشروع عند الاكتمال',
     'يُخطر مدير المشروع فور اكتمال المشروع بالكامل',
     'project_completed', null, 'notify_project_manager', null),

    (p_org_id, 'إنشاء مهمة متابعة تلقائيًا بعد الاكتمال',
     'ينشئ مهمة متابعة لنفس المسؤول عند اكتمال أي مهمة',
     'task_status_changed', '{"status": "completed"}'::jsonb, 'create_followup_task', null);
end;
$$;

do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    if not exists (select 1 from public.automation_rule_templates where organization_id = org.id) then
      perform public.seed_default_automation_templates(org.id);
    end if;
  end loop;
end $$;

create or replace function public.seed_automation_templates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_automation_templates(new.id);
  return new;
end;
$$;

create trigger organizations_seed_automation_templates
  after insert on public.organizations
  for each row execute function public.seed_automation_templates_trigger();

-- Instantiates a template into a real, editable automation_rules row - a
-- one-time copy, not a live link, so editing/deleting the resulting rule
-- never touches the template it came from. Re-derives org+role from auth.uid()
-- every call rather than trusting anything passed in, same as every other
-- privilege-sensitive function in this project.
create or replace function public.use_automation_rule_template(p_template_id uuid, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl public.automation_rule_templates;
  caller_org uuid;
  new_rule_id uuid;
begin
  select organization_id into caller_org from public.users where id = auth.uid();

  if public.current_user_role() <> 'super_admin' then
    raise exception 'غير مصرح لك بإدارة الأتمتة';
  end if;

  select * into tpl from public.automation_rule_templates
    where id = p_template_id and organization_id = caller_org;

  if tpl.id is null then
    raise exception 'القالب غير موجود';
  end if;

  insert into public.automation_rules
    (organization_id, name, trigger_event, conditions, action_type, action_params)
  values
    (caller_org, coalesce(nullif(trim(p_name), ''), tpl.name), tpl.trigger_event, tpl.conditions, tpl.action_type, tpl.action_params)
  returning id into new_rule_id;

  return new_rule_id;
end;
$$;
