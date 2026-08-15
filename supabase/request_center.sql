-- MONJEZ 3.0 — P05: Request Center
-- Run after schema.sql, rls.sql, workflow_engine.sql, storage.sql.
--
-- Extends the existing generic workflow engine (workflow_templates/
-- workflow_steps/workflow_requests/workflow_actions) rather than building
-- a parallel "requests" system - that engine already does multi-step
-- approval chains, escalate/reassign/cancel, end to end. This adds what
-- was actually missing: priority, attachments, a per-type SLA target, a
-- draft stage, and the plan's own explicit architectural decision -
-- "Request ≠ Task: a Request can generate one or more Tasks via
-- Workflow" - implemented as: an approved request whose TYPE is
-- configured to need follow-up work creates a real task row and moves to
-- 'processing'; when that task is later marked completed, the request is
-- automatically marked completed too. A type that doesn't need follow-up
-- work (a plain approval) just goes straight to 'approved'.

-- ============================================================
-- workflow_templates: SLA target + task-generation config per request type
-- ============================================================

alter table public.workflow_templates
  add column sla_hours int check (sla_hours is null or sla_hours > 0),
  add column creates_task boolean not null default false,
  add column task_assignee_type text check (task_assignee_type in ('requester', 'department_manager', 'specific_user')),
  add column task_assignee_user_id uuid references public.users(id) on delete set null;

-- ============================================================
-- workflow_requests: priority + SLA deadline + wider lifecycle
-- (draft/pending/approved/rejected/processing/completed/cancelled).
-- 'approved' is a real terminal state for a request type with no
-- follow-up task (creates_task = false, e.g. a plain leave/approval
-- request) - 'processing' -> 'completed' is only for types that generate
-- a task.
-- ============================================================

alter table public.workflow_requests
  add column priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  add column sla_due_at timestamptz;

alter table public.workflow_requests drop constraint workflow_requests_status_check;
alter table public.workflow_requests
  add constraint workflow_requests_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled'));

-- ============================================================
-- tasks: the link back to the request that generated it
-- ============================================================

alter table public.tasks
  add column source_request_id uuid references public.workflow_requests(id) on delete set null;

-- when a generated task is completed, complete the request that spawned
-- it - only while still 'processing', so this never overwrites a request
-- some other action already moved elsewhere
create or replace function public.sync_request_status_from_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_request_id is not null and new.status = 'completed' and old.status is distinct from 'completed' then
    update public.workflow_requests
    set status = 'completed'
    where id = new.source_request_id and status = 'processing';
  end if;
  return new;
end;
$$;

create trigger tasks_sync_request_status
  after update on public.tasks
  for each row execute function public.sync_request_status_from_task();

-- ============================================================
-- submit_workflow_request: now takes priority + an optional "save as
-- draft" flag. A draft is a real row (status='draft') the requester can
-- keep editing before actually submitting it - nothing is logged to
-- workflow_actions until it's genuinely submitted, since nothing
-- happened yet from anyone else's point of view.
-- ============================================================

create or replace function public.submit_workflow_request(
  p_template_id uuid,
  p_title text,
  p_details text default null,
  p_priority text default 'medium',
  p_save_as_draft boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  org uuid;
  tmpl record;
begin
  select organization_id into org from public.users where id = auth.uid();

  if org is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception 'عنوان الطلب مطلوب';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'أولوية غير صالحة';
  end if;

  select id, sla_hours into tmpl
    from public.workflow_templates
    where id = p_template_id and organization_id = org and is_active;
  if not found then
    raise exception 'نوع الطلب غير صالح';
  end if;

  insert into public.workflow_requests (
    organization_id, template_id, requested_by, title, details, priority,
    current_step_position, status, sla_due_at
  )
  values (
    org, p_template_id, auth.uid(), trim(p_title), p_details, p_priority,
    1,
    case when p_save_as_draft then 'draft' else 'pending' end,
    case when p_save_as_draft or tmpl.sla_hours is null then null
      else now() + (tmpl.sla_hours || ' hours')::interval end
  )
  returning id into new_id;

  if not p_save_as_draft then
    insert into public.workflow_actions (request_id, step_position, actor_id, action_type, note)
    values (new_id, 1, auth.uid(), 'submit', null);
  end if;

  return new_id;
end;
$$;

create or replace function public.update_workflow_request_draft(
  p_request_id uuid,
  p_title text,
  p_details text default null,
  p_priority text default 'medium'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_title is null or trim(p_title) = '' then
    raise exception 'عنوان الطلب مطلوب';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'أولوية غير صالحة';
  end if;

  update public.workflow_requests
  set title = trim(p_title), details = p_details, priority = p_priority
  where id = p_request_id and requested_by = auth.uid() and status = 'draft';

  if not found then
    raise exception 'تعذر تعديل هذه المسودة';
  end if;
end;
$$;

create or replace function public.submit_workflow_request_draft(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.workflow_requests;
  tmpl record;
begin
  select * into req from public.workflow_requests
    where id = p_request_id and requested_by = auth.uid() and status = 'draft';
  if not found then
    raise exception 'تعذر إرسال هذه المسودة';
  end if;

  select sla_hours into tmpl from public.workflow_templates where id = req.template_id;

  update public.workflow_requests
  set status = 'pending',
      sla_due_at = case when tmpl.sla_hours is null then null
        else now() + (tmpl.sla_hours || ' hours')::interval end
  where id = p_request_id;

  insert into public.workflow_actions (request_id, step_position, actor_id, action_type, note)
  values (p_request_id, req.current_step_position, auth.uid(), 'submit', null);
end;
$$;

-- ============================================================
-- act_on_workflow_request: cancel now also allowed from 'draft' (not
-- just 'pending'), and the approve branch's final-step case now consults
-- the template's creates_task config instead of always landing on
-- 'approved'.
-- ============================================================

create or replace function public.act_on_workflow_request(
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
  tmpl_creates_task boolean;
  tmpl_assignee_type text;
  tmpl_assignee_user uuid;
  requester_dept uuid;
  resolved_assignee uuid;
begin
  select * into req from public.workflow_requests where id = p_request_id;
  if req is null then
    raise exception 'الطلب غير موجود';
  end if;

  if p_action = 'cancel' then
    if req.requested_by != caller then
      raise exception 'فقط مقدّم الطلب يمكنه إلغاءه';
    end if;
    if req.status not in ('draft', 'pending') then
      raise exception 'لا يمكن إلغاء طلب في هذه الحالة';
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
        select creates_task, task_assignee_type, task_assignee_user_id
          into tmpl_creates_task, tmpl_assignee_type, tmpl_assignee_user
          from public.workflow_templates where id = req.template_id;

        if tmpl_creates_task then
          select department_id into requester_dept from public.users where id = req.requested_by;
          resolved_assignee := case tmpl_assignee_type
            when 'requester' then req.requested_by
            when 'specific_user' then tmpl_assignee_user
            else (select manager_id from public.departments where id = requester_dept)
          end;
          resolved_assignee := coalesce(resolved_assignee, req.requested_by);

          insert into public.tasks (
            organization_id, title, description, assigned_to, created_by, priority, status, source_request_id
          )
          values (
            req.organization_id, 'طلب: ' || req.title, req.details, resolved_assignee, caller, req.priority,
            'new', req.id
          );

          update public.workflow_requests
            set status = 'processing', current_step_override_user_id = null, is_escalated = false
            where id = p_request_id;
        else
          update public.workflow_requests
            set status = 'approved', current_step_override_user_id = null, is_escalated = false
            where id = p_request_id;
        end if;
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

-- ============================================================
-- workflow_request_attachments - same shape as task_attachments
-- (schema.sql/task_attachments_v2.sql), own dedicated bucket rather than
-- extending the shared "task-attachments" one, to avoid touching its
-- existing policies (which assume the first storage path segment is
-- always a task id).
-- ============================================================

create table public.workflow_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workflow_requests(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz not null default now()
);

alter table public.workflow_request_attachments enable row level security;

create policy workflow_request_attachments_select on public.workflow_request_attachments
  for select using (exists (select 1 from public.workflow_requests r where r.id = request_id));

create policy workflow_request_attachments_insert on public.workflow_request_attachments
  for insert with check (
    exists (select 1 from public.workflow_requests r where r.id = request_id)
    and uploaded_by = auth.uid()
  );

create policy workflow_request_attachments_delete on public.workflow_request_attachments
  for delete using (uploaded_by = auth.uid() or public.current_user_role() = 'super_admin');

insert into storage.buckets (id, name, public)
values ('workflow-request-attachments', 'workflow-request-attachments', false)
on conflict (id) do nothing;

create policy workflow_request_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'workflow-request-attachments'
    and exists (
      select 1 from public.workflow_requests r
      where r.id = (storage.foldername(name))[1]::uuid
    )
  );

create policy workflow_request_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'workflow-request-attachments'
    and owner = auth.uid()
    and exists (
      select 1 from public.workflow_requests r
      where r.id = (storage.foldername(name))[1]::uuid
    )
  );

create policy workflow_request_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'workflow-request-attachments'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );

-- ============================================================
-- Seed the 10 request types from the plan (single department_manager/
-- super_admin approval step each - an admin can add more steps later via
-- the existing workflow-templates UI, this just makes every type usable
-- immediately instead of starting empty). Runs for every organization
-- that already exists, and a trigger seeds the same defaults for any
-- organization created afterward (Google self-signup) - same pattern as
-- P02's role_permissions seeding.
-- ============================================================

create or replace function public.seed_default_request_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  new_template_id uuid;
begin
  for t in
    select * from (values
      ('إجازة', 'department_manager'::text, 24, false, null::text),
      ('شراء', 'department_manager', 48, true, 'department_manager'),
      ('صيانة', 'department_manager', 24, true, 'department_manager'),
      ('دعم تقني', 'department_manager', 8, true, 'department_manager'),
      ('مستند', 'department_manager', 48, true, 'department_manager'),
      ('اعتماد', 'department_manager', 24, false, null),
      ('تدريب', 'department_manager', 72, true, 'department_manager'),
      ('مستلزمات', 'department_manager', 48, true, 'department_manager'),
      ('عمل عن بعد', 'department_manager', 24, false, null),
      ('طلب إداري', 'super_admin', 48, false, null)
    ) as v(name, approver_type, sla_hours, creates_task, task_assignee_type)
  loop
    insert into public.workflow_templates (organization_id, name, sla_hours, creates_task, task_assignee_type)
    values (p_org_id, t.name, t.sla_hours, t.creates_task, t.task_assignee_type)
    returning id into new_template_id;

    insert into public.workflow_steps (template_id, position, name, approver_type)
    values (new_template_id, 1, 'موافقة', t.approver_type);
  end loop;
end;
$$;

do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    if not exists (select 1 from public.workflow_templates where organization_id = org.id) then
      perform public.seed_default_request_templates(org.id);
    end if;
  end loop;
end $$;

create or replace function public.seed_request_templates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_request_templates(new.id);
  return new;
end;
$$;

create trigger organizations_seed_request_templates
  after insert on public.organizations
  for each row execute function public.seed_request_templates_trigger();
