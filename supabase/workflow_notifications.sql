-- TaskFlow Pro (MONJEZ 2.0) — Workflow notifications fix
-- Run after workflow_engine.sql.
--
-- submit_workflow_request()/act_on_workflow_request() wrote to
-- workflow_actions (the audit trail) but never to notifications - a
-- request could sit waiting for an approver, or get approved/rejected,
-- with nobody actually told. Reuses the existing notifications table/bell
-- (no parallel notification system), same as every other feature in this
-- project.
--
-- workflow_step_approver_ids() returns a SET because a step's approver
-- isn't always exactly one person - approver_type = 'super_admin' (or an
-- escalated step) means "any super_admin in the org", which can be several
-- people; specific_user/department_manager/an active reassignment override
-- each resolve to exactly one.
create or replace function public.workflow_step_approver_ids(p_request_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.workflow_requests;
  step public.workflow_steps;
  requester_dept uuid;
  dept_manager uuid;
begin
  select * into req from public.workflow_requests where id = p_request_id;
  if req is null then
    return;
  end if;

  if req.current_step_override_user_id is not null then
    return query select req.current_step_override_user_id;
  end if;

  if req.is_escalated then
    return query select id from public.users where organization_id = req.organization_id and role = 'super_admin';
    return;
  end if;

  select * into step from public.workflow_steps
    where template_id = req.template_id and position = req.current_step_position;
  if step is null then
    return;
  end if;

  if step.approver_type = 'specific_user' then
    return query select step.specific_user_id;
  elsif step.approver_type = 'super_admin' then
    return query select id from public.users where organization_id = req.organization_id and role = 'super_admin';
  elsif step.approver_type = 'department_manager' then
    select department_id into requester_dept from public.users where id = req.requested_by;
    select manager_id into dept_manager from public.departments where id = requester_dept;
    if dept_manager is not null then
      return query select dept_manager;
    end if;
  end if;

  return;
end;
$$;

create or replace function public.notify_workflow_approvers(p_request_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  for uid in select public.workflow_step_approver_ids(p_request_id) loop
    insert into public.notifications (user_id, type, message)
    values (uid, 'workflow_pending_approval', p_message);
  end loop;
end;
$$;

-- submit_workflow_request: now also notifies whoever the first step's
-- approver(s) are, right after the request (and its 'submit' audit row)
-- is created.
create or replace function public.submit_workflow_request(
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

  perform public.notify_workflow_approvers(new_id, 'طلب جديد بانتظار موافقتك: ' || trim(p_title));

  return new_id;
end;
$$;

-- act_on_workflow_request: approve/reject now notify the requester about
-- the outcome; an approval that advances to another step (rather than
-- finishing the request) also notifies that next step's approver(s) -
-- otherwise a workflow with more than one step would only ever notify
-- the very first approver, and everyone downstream would be silently
-- skipped.
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
        insert into public.notifications (user_id, type, message)
        values (req.requested_by, 'workflow_approved', 'تم قبول طلبك: ' || req.title);
      else
        update public.workflow_requests
          set current_step_position = current_step_position + 1,
              current_step_override_user_id = null, is_escalated = false
          where id = p_request_id;
        perform public.notify_workflow_approvers(p_request_id, 'طلب بانتظار موافقتك: ' || req.title);
      end if;

    elsif p_action = 'reject' then
      update public.workflow_requests set status = 'rejected' where id = p_request_id;
      insert into public.notifications (user_id, type, message)
      values (req.requested_by, 'workflow_rejected', 'تم رفض طلبك: ' || req.title);

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
