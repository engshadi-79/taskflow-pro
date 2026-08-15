-- MONJEZ 3.0 — P02: Security & RBAC
-- Run after schema.sql, rls.sql, foundation_3_0.sql.
--
-- This layers granular permissions ON TOP of the existing 3-role model
-- and its 132 RLS policies (rls.sql) — RLS stays the base line of
-- defense exactly as it is today, per the plan's own instruction
-- ("Roles + Permissions + ... فوق RLS كخط دفاع أساسي"). Nothing here
-- replaces a single existing RLS policy or the `users.role` check
-- constraint; `role_permissions.role` is a plain text column holding one
-- of the same 3 existing values, not a foreign key to a new roles table -
-- rebuilding the role model itself (which every RLS policy's
-- current_user_role() comparisons depend on) is exactly the kind of
-- "rebuild what works without a clear architectural reason" the plan's
-- own rules forbid.
--
-- What "Super Admin manages the Permission Matrix without code changes"
-- means here concretely: the ROLE -> PERMISSION mapping is data
-- (role_permissions), editable from /dashboard/settings/permissions,
-- instead of the hardcoded boolean checks P01's permissions.ts started
-- with. A brand new role NAME still requires a code change (the users.role
-- check constraint + RLS), but what that role/an individual user can DO
-- inside the app no longer does.
--
-- role_permissions is per-organization (this app supports multiple
-- organizations - Google self-signup creates a new one per company) so
-- one organization's super_admin editing their matrix can never affect
-- another organization's roles. It's seeded below to reproduce EXACTLY
-- today's real behavior (audited per-page role checks) for every
-- organization that already exists, and a trigger seeds the same
-- defaults automatically for any organization created afterward -
-- applying this migration changes zero effective permissions on its own;
-- only editing the matrix afterward does.

-- ============================================================
-- permissions — the canonical catalogue, grouped by category for the
-- matrix UI. Global, not per-organization: the SET of possible
-- capabilities is a product concept, not per-org data (same reasoning as
-- Stripe/GitHub-style systems: permission definitions are global, GRANTS
-- are scoped - that scoping is role_permissions below).
-- ============================================================

create table public.permissions (
  key text primary key,
  label text not null,
  category text not null
);

insert into public.permissions (key, label, category) values
  ('tasks.read', 'عرض المهام', 'tasks'),
  ('tasks.create', 'إنشاء مهام', 'tasks'),
  ('tasks.update', 'تعديل المهام', 'tasks'),
  ('tasks.delete', 'حذف المهام', 'tasks'),
  ('employees.read', 'عرض الموظفين', 'employees'),
  ('employees.update', 'تعديل بيانات الموظفين', 'employees'),
  ('projects.manage', 'إدارة المشاريع', 'projects'),
  ('reports.read', 'عرض التقارير', 'reports'),
  ('requests.approve', 'الموافقة على الطلبات', 'requests'),
  ('workflows.manage', 'إدارة قوالب سير العمل', 'workflows'),
  ('automation.manage', 'إدارة قواعد الأتمتة', 'automation'),
  ('sla.manage', 'إدارة سياسات SLA', 'sla'),
  ('notifications.send', 'إرسال إشعارات إدارية', 'notifications'),
  ('notifications.send_org_wide', 'إرسال إشعارات لكل المؤسسة', 'notifications'),
  ('organization.manage', 'إدارة إعدادات المؤسسة', 'organization');

-- ============================================================
-- role_permissions — the editable matrix, one per (organization, role,
-- permission). `scope` documents the intended reach (RLS still does the
-- actual data filtering - this is what the Permission Service and UI
-- reason about).
-- ============================================================

create table public.role_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('super_admin', 'department_manager', 'employee')),
  permission_key text not null references public.permissions(key) on delete cascade,
  scope text not null default 'organization' check (scope in ('organization', 'department', 'team', 'self')),
  primary key (organization_id, role, permission_key)
);

-- seed every organization that already exists: super_admin gets
-- everything, organization-wide
insert into public.role_permissions (organization_id, role, permission_key, scope)
  select o.id, 'super_admin', p.key, 'organization'
  from public.organizations o
  cross join public.permissions p;

-- seed: department_manager - matches today's actual per-page role checks
-- (workflow-templates/automation-rules/sla-policies/settings are all
-- super_admin-only today; requests.approve matches
-- can_act_on_workflow_request()'s 'department_manager' approver_type)
insert into public.role_permissions (organization_id, role, permission_key, scope)
  select o.id, 'department_manager', v.permission_key, v.scope
  from public.organizations o
  cross join (values
    ('tasks.read', 'department'),
    ('tasks.create', 'department'),
    ('tasks.update', 'department'),
    ('tasks.delete', 'department'),
    ('employees.read', 'department'),
    ('employees.update', 'department'),
    ('projects.manage', 'department'),
    ('reports.read', 'department'),
    ('requests.approve', 'department'),
    ('notifications.send', 'department')
  ) as v(permission_key, scope);

-- seed: employee - self scope only
insert into public.role_permissions (organization_id, role, permission_key, scope)
  select o.id, 'employee', v.permission_key, v.scope
  from public.organizations o
  cross join (values ('tasks.read', 'self'), ('reports.read', 'self')) as v(permission_key, scope);

-- keep future organizations (Google self-signup creates one per company)
-- seeded with the same defaults automatically - without this, every user
-- in a brand-new organization would have zero effective permissions until
-- someone manually populated their matrix
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
    (new.id, 'department_manager', 'requests.approve', 'department'),
    (new.id, 'department_manager', 'notifications.send', 'department'),
    (new.id, 'employee', 'tasks.read', 'self'),
    (new.id, 'employee', 'reports.read', 'self');

  return new;
end;
$$;

create trigger organizations_seed_role_permissions
  after insert on public.organizations
  for each row execute function public.seed_default_role_permissions();

-- ============================================================
-- user_permission_overrides — per-user grant/revoke beyond the role
-- default (e.g. one employee given requests.approve for a specific
-- delegation, without inventing a whole new role for it).
-- ============================================================

create table public.user_permission_overrides (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;

create policy permissions_select on public.permissions
  for select using (public.current_user_role() = 'super_admin');

create policy role_permissions_select on public.role_permissions
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy role_permissions_insert on public.role_permissions
  for insert with check (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy role_permissions_delete on public.role_permissions
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- user_permission_overrides has no organization_id column of its own, so
-- every policy re-derives the target user's org via `users` - without
-- this, a super_admin of one organization could grant/revoke/read a
-- permission override for a user in a DIFFERENT organization by id alone
create policy user_permission_overrides_select on public.user_permission_overrides
  for select using (
    user_id = auth.uid()
    or (
      public.current_user_role() = 'super_admin'
      and exists (
        select 1 from public.users u
        where u.id = user_id and u.organization_id = public.current_org_id()
      )
    )
  );

create policy user_permission_overrides_insert on public.user_permission_overrides
  for insert with check (
    public.current_user_role() = 'super_admin'
    and exists (
      select 1 from public.users u
      where u.id = user_id and u.organization_id = public.current_org_id()
    )
  );

create policy user_permission_overrides_delete on public.user_permission_overrides
  for delete using (
    public.current_user_role() = 'super_admin'
    and exists (
      select 1 from public.users u
      where u.id = user_id and u.organization_id = public.current_org_id()
    )
  );

-- ============================================================
-- get_user_permissions — single source of truth: role default for the
-- user's OWN organization, minus explicit revokes, plus explicit grants.
-- SECURITY DEFINER because a regular user has no SELECT policy on
-- role_permissions to join against, and must not need one just to
-- compute their own effective permissions.
--
-- Explicitly excludes an inactive user (returns empty) - required per
-- this phase's own mandated security test ("inactive user على API"): an
-- inactive user still has a `role` value in `users`, so without this
-- check they would keep every permission their role grants even while
-- current_org_id() already treats them as org-less everywhere else.
-- ============================================================

create or replace function public.get_user_permissions(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select rp.permission_key
    from public.role_permissions rp
    join public.users u
      on u.role = rp.role and u.organization_id = rp.organization_id
    where u.id = p_user_id and u.is_active
  ),
  revoked as (
    select permission_key from public.user_permission_overrides
    where user_id = p_user_id and granted = false
  ),
  granted as (
    select permission_key from public.user_permission_overrides
    where user_id = p_user_id and granted = true
  ),
  effective as (
    (select permission_key from base
     except
     select permission_key from revoked)
    union
    select permission_key from granted
  )
  select coalesce(array_agg(permission_key), array[]::text[]) from effective;
$$;

revoke all on function public.get_user_permissions(uuid) from public;
grant execute on function public.get_user_permissions(uuid) to authenticated;

-- ============================================================
-- toggle_role_permission — the matrix UI's only write path (instead of
-- letting the client insert/delete role_permissions rows directly, which
-- would need two separate RLS-covered calls and no single audit point).
-- organization_id is always the caller's own - never a parameter - so
-- there is no way to target another organization's matrix even by
-- tampering with the RPC call.
-- ============================================================

create or replace function public.toggle_role_permission(
  p_role text,
  p_permission_key text,
  p_enabled boolean,
  p_scope text default 'organization'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid := current_org_id();
begin
  if public.current_user_role() != 'super_admin' then
    raise exception 'غير مصرح لك بتعديل مصفوفة الصلاحيات';
  end if;

  if p_enabled then
    insert into public.role_permissions (organization_id, role, permission_key, scope)
    values (caller_org, p_role, p_permission_key, p_scope)
    on conflict (organization_id, role, permission_key) do update set scope = excluded.scope;
  else
    delete from public.role_permissions
    where organization_id = caller_org and role = p_role and permission_key = p_permission_key;
  end if;
end;
$$;

revoke all on function public.toggle_role_permission(text, text, boolean, text) from public;
grant execute on function public.toggle_role_permission(text, text, boolean, text) to authenticated;
