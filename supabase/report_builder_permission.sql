-- صلاحية جديدة لمنشئ التقارير - تعيد استخدام كتالوج permissions/
-- role_permissions الموجود في security_rbac.sql بدل اختراع آلية منفصلة.
insert into public.permissions (key, label, category) values
  ('reports.build', 'إنشاء تقارير مخصّصة', 'reports')
on conflict (key) do nothing;

-- المؤسسات الموجودة حاليًا: المدير العام يحصل على كل صلاحية أصلًا
-- (نفس نمط cross join الذي استخدمه security_rbac.sql عند الإعداد الأول).
insert into public.role_permissions (organization_id, role, permission_key, scope)
select o.id, 'super_admin', 'reports.build', 'organization'
from public.organizations o
on conflict (organization_id, role, permission_key) do nothing;

insert into public.role_permissions (organization_id, role, permission_key, scope)
select o.id, 'department_manager', 'reports.build', 'department'
from public.organizations o
on conflict (organization_id, role, permission_key) do nothing;

-- المؤسسات المستقبلية: نوسّع نفس دالة التزويد التلقائي بدل إضافة trigger
-- منفصل، حتى لا تحتاج مؤسسة جديدة هجرة لاحقة يدوية لهذه الصلاحية تحديدًا.
create or replace function public.seed_default_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_permissions (organization_id, role, permission_key, scope)
    select new.id, 'super_admin', key, 'organization' from public.permissions;

  insert into public.role_permissions (organization_id, role, permission_key, scope) values
    (new.id, 'department_manager', 'tasks.read', 'department'),
    (new.id, 'department_manager', 'tasks.create', 'department'),
    (new.id, 'department_manager', 'tasks.update', 'department'),
    (new.id, 'department_manager', 'tasks.delete', 'department'),
    (new.id, 'department_manager', 'employees.read', 'department'),
    (new.id, 'department_manager', 'employees.update', 'department'),
    (new.id, 'department_manager', 'projects.manage', 'department'),
    (new.id, 'department_manager', 'reports.read', 'department'),
    (new.id, 'department_manager', 'reports.build', 'department'),
    (new.id, 'department_manager', 'requests.approve', 'department'),
    (new.id, 'department_manager', 'notifications.send', 'department'),
    (new.id, 'employee', 'tasks.read', 'self'),
    (new.id, 'employee', 'reports.read', 'self');

  return new;
end;
$$;
