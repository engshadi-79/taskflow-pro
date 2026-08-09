-- TaskFlow Pro (MONJEZ 2.0) — Phase 02: Database Foundation
-- Run after schema.sql, rls.sql, and every other file already listed in
-- PROJECT.md's migration order (this one doesn't depend on any of the
-- profile/report additions, just the original schema + RLS helpers).
--
-- Adds project-management structure on top of the existing task system:
-- projects, project membership, milestones, task dependencies, checklists,
-- watchers, labels, and time entries. None of these existed before (checked
-- schema.sql first) - this is new ground, not a duplicate of anything.
--
-- No UI in this migration. No new permission system: every policy below
-- reuses current_user_role()/current_org_id()/current_department_id() from
-- rls.sql, the same three-role model (super_admin/department_manager/
-- employee) already governing tasks/users/departments.

-- ============================================================
-- projects
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.users(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'planning' check (
    status in ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')
  ),
  start_date date,
  due_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_due_after_start check (
    start_date is null or due_date is null or due_date >= start_date
  )
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ============================================================
-- project_members — explicit membership, independent of department.
-- Project visibility/edit rights for non-admins are driven by this table,
-- not by department alone (a project can pull people from multiple
-- departments).
-- ============================================================
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ============================================================
-- project_milestones
-- ============================================================
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- tasks: link to project + milestone (both optional - a task can stay
-- standalone exactly as it works today)
-- ============================================================
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null;

-- A task's milestone (if any) must belong to that same task's project -
-- this can't be a plain check constraint since it compares across tables,
-- so it's a trigger instead.
create function public.enforce_task_milestone_project_match()
returns trigger
language plpgsql
as $$
declare
  milestone_project uuid;
begin
  if new.milestone_id is null then
    return new;
  end if;

  if new.project_id is null then
    raise exception 'لا يمكن ربط المهمة بمرحلة بدون ربطها بالمشروع نفسه';
  end if;

  select project_id into milestone_project
  from public.project_milestones where id = new.milestone_id;

  if milestone_project is null or milestone_project != new.project_id then
    raise exception 'المرحلة المحددة لا تنتمي إلى مشروع هذه المهمة';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_milestone_project_match
  before insert or update on public.tasks
  for each row execute function public.enforce_task_milestone_project_match();

-- ============================================================
-- task_dependencies (foundation only - cycle detection and the
-- "cannot start until dependency clears" enforcement are Phase 05's job,
-- per the phased plan; this phase just gives it a safe table to build on)
-- ============================================================
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check (
    dependency_type in ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')
  ),
  created_at timestamptz not null default now(),
  constraint task_dependencies_no_self_reference check (task_id != depends_on_task_id),
  unique (task_id, depends_on_task_id)
);

-- Both sides of a dependency must be in the same organization - two plain
-- FKs to tasks can't express that, hence a trigger (same reasoning as the
-- milestone/project check above).
create function public.enforce_task_dependency_same_org()
returns trigger
language plpgsql
as $$
declare
  org_a uuid;
  org_b uuid;
begin
  select organization_id into org_a from public.tasks where id = new.task_id;
  select organization_id into org_b from public.tasks where id = new.depends_on_task_id;

  if org_a is null or org_b is null or org_a != org_b then
    raise exception 'لا يمكن ربط مهام من مؤسسات مختلفة كتبعية';
  end if;

  return new;
end;
$$;

create trigger task_dependencies_enforce_same_org
  before insert or update on public.task_dependencies
  for each row execute function public.enforce_task_dependency_same_org();

-- ============================================================
-- task_checklists — a flat list of checkable steps per task (not grouped
-- checklists; the plan's own example is a single flat list per task)
-- ============================================================
create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null,
  is_completed boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- task_watchers
-- ============================================================
create table public.task_watchers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- ============================================================
-- labels + task_labels
-- ============================================================
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- ============================================================
-- task_time_entries (foundation for Phase 07 - duration is a generated
-- column so it can never drift from started_at/ended_at, and never relies
-- on the browser's clock for the stored value)
-- ============================================================
create table public.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer generated always as (
    case when ended_at is not null
      then extract(epoch from (ended_at - started_at))::integer
      else null
    end
  ) stored,
  note text,
  created_at timestamptz not null default now(),
  constraint task_time_entries_ended_after_started check (ended_at is null or ended_at > started_at)
);

-- ============================================================
-- indexes
-- ============================================================
create index projects_organization_id_idx on public.projects(organization_id);
create index projects_department_id_idx on public.projects(department_id);
create index projects_manager_id_idx on public.projects(manager_id);
create index projects_status_idx on public.projects(status);
create index project_members_project_id_idx on public.project_members(project_id);
create index project_members_user_id_idx on public.project_members(user_id);
create index project_milestones_project_id_idx on public.project_milestones(project_id);
create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_milestone_id_idx on public.tasks(milestone_id);
create index task_dependencies_task_id_idx on public.task_dependencies(task_id);
create index task_dependencies_depends_on_task_id_idx on public.task_dependencies(depends_on_task_id);
create index task_checklists_task_id_idx on public.task_checklists(task_id);
create index task_watchers_task_id_idx on public.task_watchers(task_id);
create index task_watchers_user_id_idx on public.task_watchers(user_id);
create index labels_organization_id_idx on public.labels(organization_id);
create index task_labels_label_id_idx on public.task_labels(label_id);
create index task_time_entries_task_id_idx on public.task_time_entries(task_id);
create index task_time_entries_user_id_idx on public.task_time_entries(user_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_watchers enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_time_entries enable row level security;

-- projects: super_admin sees/manages everything in their org; a
-- department_manager sees their own department's projects, plus (like
-- everyone else) any project they're an explicit member of; a plain
-- employee only sees projects they're a member of.
create policy projects_select on public.projects
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
      or exists (select 1 from public.project_members m where m.project_id = id and m.user_id = auth.uid())
    )
  );

create policy projects_insert on public.projects
  for insert with check (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
    )
  );

create policy projects_update on public.projects
  for update using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
      or manager_id = auth.uid()
    )
  );

create policy projects_delete on public.projects
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- project_members/project_milestones: visible whenever the parent project
-- is visible (same "exists on the parent" trick as task_attachments_select/
-- task_comments_select in rls.sql - the subquery is itself subject to
-- projects_select, so it silently returns nothing for a project this caller
-- couldn't see anyway).
create policy project_members_select on public.project_members
  for select using (exists (select 1 from public.projects p where p.id = project_id));

create policy project_members_write on public.project_members
  for all using (
    exists (
      select 1 from public.projects p where p.id = project_id and (
        public.current_user_role() = 'super_admin'
        or p.manager_id = auth.uid()
        or (public.current_user_role() = 'department_manager' and p.department_id = public.current_department_id())
      )
    )
  );

create policy project_milestones_select on public.project_milestones
  for select using (exists (select 1 from public.projects p where p.id = project_id));

create policy project_milestones_write on public.project_milestones
  for all using (
    exists (
      select 1 from public.projects p where p.id = project_id and (
        public.current_user_role() = 'super_admin'
        or p.manager_id = auth.uid()
        or (public.current_user_role() = 'department_manager' and p.department_id = public.current_department_id())
      )
    )
  );

-- task_dependencies/task_checklists/task_watchers/task_labels: visible
-- whenever the owning task is visible, same "exists on parent" pattern
-- against tasks_select. Writing follows tasks_update's own permission
-- shape (assignee, or the manager/admin who could already update the task) -
-- editing a task's checklist/labels/dependencies is part of managing it.
create policy task_dependencies_select on public.task_dependencies
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_dependencies_write on public.task_dependencies
  for all using (
    exists (
      select 1 from public.tasks t where t.id = task_id and (
        public.current_user_role() = 'super_admin'
        or (
          public.current_user_role() = 'department_manager'
          and t.assigned_to in (select id from public.users where department_id = public.current_department_id())
        )
        or t.assigned_to = auth.uid()
      )
    )
  );

create policy task_checklists_select on public.task_checklists
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_checklists_write on public.task_checklists
  for all using (
    exists (
      select 1 from public.tasks t where t.id = task_id and (
        public.current_user_role() = 'super_admin'
        or (
          public.current_user_role() = 'department_manager'
          and t.assigned_to in (select id from public.users where department_id = public.current_department_id())
        )
        or t.assigned_to = auth.uid()
      )
    )
  );

create policy task_labels_select on public.task_labels
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_labels_write on public.task_labels
  for all using (
    exists (
      select 1 from public.tasks t where t.id = task_id and (
        public.current_user_role() = 'super_admin'
        or (
          public.current_user_role() = 'department_manager'
          and t.assigned_to in (select id from public.users where department_id = public.current_department_id())
        )
        or t.assigned_to = auth.uid()
      )
    )
  );

-- task_watchers: anyone who can see the task can see who's watching it;
-- watching/unwatching yourself is self-service, not something one user does
-- on another's behalf (yet).
create policy task_watchers_select on public.task_watchers
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_watchers_write on public.task_watchers
  for all using (user_id = auth.uid());

-- labels: shared org-wide vocabulary, same creators as task_templates
-- (super_admin/department_manager), readable by the whole organization.
create policy labels_select on public.labels
  for select using (organization_id = public.current_org_id());

create policy labels_write on public.labels
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
  );

-- task_time_entries: mirrors activity_log_select's visibility (self, or
-- your department's manager, or super_admin) - logging time is
-- self-service, correcting/deleting is also allowed for super_admin per
-- the plan's "حذف/تصحيح حسب الصلاحيات" requirement.
create policy task_time_entries_select on public.task_time_entries
  for select using (
    user_id = auth.uid()
    or public.current_user_role() = 'super_admin'
    or (
      public.current_user_role() = 'department_manager'
      and user_id in (select id from public.users where department_id = public.current_department_id())
    )
  );

create policy task_time_entries_insert on public.task_time_entries
  for insert with check (user_id = auth.uid());

create policy task_time_entries_update on public.task_time_entries
  for update using (user_id = auth.uid() or public.current_user_role() = 'super_admin');

create policy task_time_entries_delete on public.task_time_entries
  for delete using (user_id = auth.uid() or public.current_user_role() = 'super_admin');
