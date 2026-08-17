-- TaskFlow Pro (MONJEZ) — manual task archiving
--
-- Lets a manager (super_admin / department_manager) hide a completed task
-- from the Kanban board without changing its status or deleting it - all
-- existing reports/SLA/KPI calculations keyed off task.status are
-- unaffected, since archiving is a separate flag, not a status value.

alter table public.tasks
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null;

create index if not exists tasks_is_archived_idx on public.tasks(is_archived);
