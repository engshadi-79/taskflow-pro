-- TaskFlow Pro — Phase 2: Row Level Security
-- Run this after schema.sql. Paste directly into the Supabase SQL Editor.
--
-- General rule (see PROJECT_PLAN.md section 4):
--   super_admin         -> full access within their organization_id
--   department_manager  -> only rows belonging to their department
--   employee            -> only their own rows

-- ============================================================
-- helper functions
--
-- These are SECURITY DEFINER so they bypass RLS on public.users when
-- looking up the caller's own profile. Without this, any policy on
-- public.users that queries public.users would recurse infinitely.
-- ============================================================
create function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.users where id = auth.uid();
$$;

create function public.current_department_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select department_id from public.users where id = auth.uid();
$$;

-- ============================================================
-- enable RLS
-- ============================================================
alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.task_templates enable row level security;

-- ============================================================
-- organizations
-- ============================================================
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

create policy organizations_update on public.organizations
  for update using (id = public.current_org_id() and public.current_user_role() = 'super_admin');

-- ============================================================
-- departments
-- ============================================================
create policy departments_select on public.departments
  for select using (organization_id = public.current_org_id());

create policy departments_insert on public.departments
  for insert with check (organization_id = public.current_org_id() and public.current_user_role() = 'super_admin');

create policy departments_update on public.departments
  for update using (organization_id = public.current_org_id() and public.current_user_role() = 'super_admin');

create policy departments_delete on public.departments
  for delete using (organization_id = public.current_org_id() and public.current_user_role() = 'super_admin');

-- ============================================================
-- users
-- ============================================================
create policy users_select on public.users
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
      or id = auth.uid()
    )
  );

create policy users_insert on public.users
  for insert with check (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy users_update on public.users
  for update using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy users_delete on public.users
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- tasks
-- ============================================================
create policy tasks_select on public.tasks
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (
        public.current_user_role() = 'department_manager'
        and assigned_to in (select id from public.users where department_id = public.current_department_id())
      )
      or assigned_to = auth.uid()
      or created_by = auth.uid()
    )
  );

create policy tasks_insert on public.tasks
  for insert with check (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (
        public.current_user_role() = 'department_manager'
        and assigned_to in (select id from public.users where department_id = public.current_department_id())
      )
    )
  );

create policy tasks_update on public.tasks
  for update using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (
        public.current_user_role() = 'department_manager'
        and assigned_to in (select id from public.users where department_id = public.current_department_id())
      )
      or assigned_to = auth.uid()
    )
  );

create policy tasks_delete on public.tasks
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- task_attachments (visibility follows the parent task)
-- ============================================================
create policy task_attachments_select on public.task_attachments
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_attachments_insert on public.task_attachments
  for insert with check (
    exists (select 1 from public.tasks t where t.id = task_id)
    and uploaded_by = auth.uid()
  );

create policy task_attachments_delete on public.task_attachments
  for delete using (uploaded_by = auth.uid() or public.current_user_role() = 'super_admin');

-- ============================================================
-- task_comments (visibility follows the parent task)
-- ============================================================
create policy task_comments_select on public.task_comments
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_comments_insert on public.task_comments
  for insert with check (
    exists (select 1 from public.tasks t where t.id = task_id)
    and user_id = auth.uid()
  );

create policy task_comments_delete on public.task_comments
  for delete using (user_id = auth.uid() or public.current_user_role() = 'super_admin');

-- ============================================================
-- notifications (no insert policy: rows are created by
-- SECURITY DEFINER trigger functions added in a later phase)
-- ============================================================
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- ============================================================
-- activity_log
-- ============================================================
create policy activity_log_select on public.activity_log
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (
        public.current_user_role() = 'department_manager'
        and user_id in (select id from public.users where department_id = public.current_department_id())
      )
    )
  );

create policy activity_log_insert on public.activity_log
  for insert with check (
    organization_id = public.current_org_id() and user_id = auth.uid()
  );

-- ============================================================
-- task_templates
-- ============================================================
create policy task_templates_select on public.task_templates
  for select using (organization_id = public.current_org_id());

create policy task_templates_insert on public.task_templates
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
  );

create policy task_templates_update on public.task_templates
  for update using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
  );

create policy task_templates_delete on public.task_templates
  for delete using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
  );
