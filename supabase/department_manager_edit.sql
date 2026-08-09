-- TaskFlow Pro — let a department_manager set job_title/manager_id for
-- employees in their own department. Run after schema.sql, rls.sql and
-- profile_fields_v2.sql.
--
-- Unlike self_profile_update.sql, this does NOT add a plain permissive
-- UPDATE policy on public.users for department_manager. A USING/WITH CHECK
-- clause can only gate which ROWS are touched, not which columns - and here
-- the caller and the row owner are different people, so "which rows" isn't
-- enough: a department_manager with a raw UPDATE grant on their own
-- department's rows could bypass the app's field allowlist entirely and
-- PATCH a colleague's role/department_id/is_active directly over the API,
-- which is a real privilege-escalation path (not just a self-editing risk
-- like the avatar_url/full_name gap self_profile_update.sql closed).
--
-- Instead this is a SECURITY DEFINER function that IS the entire gate: it
-- checks the caller's role and (for department_manager) that the target
-- employee is in the caller's own department, validates manager_id is a
-- colleague in that same department, and only ever writes job_title and
-- manager_id - no other column is reachable through it. super_admin also
-- goes through this same function for these two fields (see updateEmployee
-- in lib/actions/users.ts), so there is exactly one validated path instead
-- of duplicating the manager_id same-department check per caller role.
create or replace function public.update_department_employee(
  p_employee_id uuid,
  p_job_title text,
  p_manager_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_org uuid;
  caller_dept uuid;
  target_org uuid;
  target_dept uuid;
begin
  select role, organization_id, department_id into caller_role, caller_org, caller_dept
  from public.users where id = auth.uid();

  if caller_role not in ('super_admin', 'department_manager') then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;

  select organization_id, department_id into target_org, target_dept
  from public.users where id = p_employee_id;

  if target_org is null or target_org != caller_org then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;

  if caller_role = 'department_manager' and (target_dept is null or target_dept != caller_dept) then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;

  if p_manager_id = p_employee_id then
    raise exception 'لا يمكن اختيار الموظف كمديره الخاص';
  end if;

  if p_manager_id is not null and not exists (
    select 1 from public.users where id = p_manager_id and department_id = target_dept
  ) then
    raise exception 'المدير المختار يجب أن يكون من نفس القسم';
  end if;

  update public.users
  set job_title = p_job_title, manager_id = p_manager_id
  where id = p_employee_id;
end;
$$;
