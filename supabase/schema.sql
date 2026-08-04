-- TaskFlow Pro — Phase 2: database schema
-- Paste this whole file into the Supabase SQL Editor and run it first.
-- Run rls.sql next, then (optionally) seed.sql.

-- ============================================================
-- organizations
-- ============================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_type text not null default 'free' check (plan_type in ('free', 'paid')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- departments
-- (manager_id references users, added after users exists below)
-- ============================================================
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  manager_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- users (extends auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null default 'employee' check (role in ('super_admin', 'department_manager', 'employee')),
  department_id uuid references public.departments(id) on delete set null,
  job_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.departments
  add constraint departments_manager_id_fkey
  foreign key (manager_id) references public.users(id) on delete set null;

-- ============================================================
-- tasks
-- ============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid not null references public.users(id) on delete restrict,
  created_by uuid references public.users(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled')),
  start_date date,
  start_time time,
  due_date date,
  due_time time,
  is_recurring boolean not null default false,
  recurrence_pattern text check (recurrence_pattern in ('daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_pattern_requires_flag check (
    (is_recurring = false and recurrence_pattern is null) or
    (is_recurring = true and recurrence_pattern is not null)
  )
);

-- ============================================================
-- task_attachments
-- ============================================================
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- task_comments
-- ============================================================
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- notifications
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- activity_log
-- ============================================================
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  description text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- task_templates
-- ============================================================
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  default_priority text not null default 'medium' check (default_priority in ('low', 'medium', 'high', 'urgent')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- indexes
-- ============================================================
create index users_organization_id_idx on public.users(organization_id);
create index users_department_id_idx on public.users(department_id);
create index departments_organization_id_idx on public.departments(organization_id);
create index tasks_organization_id_idx on public.tasks(organization_id);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_created_by_idx on public.tasks(created_by);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);
create index task_attachments_task_id_idx on public.task_attachments(task_id);
create index task_comments_task_id_idx on public.task_comments(task_id);
create index notifications_user_id_idx on public.notifications(user_id);
create index activity_log_organization_id_idx on public.activity_log(organization_id);
create index activity_log_user_id_idx on public.activity_log(user_id);
create index task_templates_organization_id_idx on public.task_templates(organization_id);

-- ============================================================
-- triggers
-- ============================================================

-- keep tasks.updated_at current on every update
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- create a matching public.users row whenever a new auth.users row appears
-- (super_admin creates managers/employees via the Supabase Admin API, passing
-- organization_id, role, full_name, department_id, job_title, phone in the
-- new user's raw_user_meta_data)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, organization_id, full_name, email, phone, role, department_id, job_title)
  values (
    new.id,
    (new.raw_user_meta_data->>'organization_id')::uuid,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    (new.raw_user_meta_data->>'department_id')::uuid,
    new.raw_user_meta_data->>'job_title'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
