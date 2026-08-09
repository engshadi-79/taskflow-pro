-- TaskFlow Pro (MONJEZ 2.0) — Phase 08: SLA Engine
-- Run after projects_foundation.sql. Reuses the existing cron/notifications
-- system (pg_cron already scheduled in notifications_and_reports.sql, the
-- notifications table and its dedupe-by-not-exists pattern from
-- send_due_date_reminders) instead of a parallel one, per the plan's own
-- instruction.
--
-- A policy is keyed by (organization_id, priority) rather than assigned to
-- individual tasks one by one - tasks.priority already exists, so "which
-- SLA applies" is just a join, no new column/UI field needed on tasks at
-- all for the assignment itself.

-- ============================================================
-- sla_policies
-- ============================================================
create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  response_minutes integer not null check (response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- only one ACTIVE policy per (org, priority) - an old inactive one can stay
-- around for history without blocking a replacement
create unique index sla_policies_org_priority_active_idx
  on public.sla_policies(organization_id, priority) where is_active;

create index sla_policies_organization_id_idx on public.sla_policies(organization_id);

alter table public.sla_policies enable row level security;

create policy sla_policies_select on public.sla_policies
  for select using (organization_id = public.current_org_id());

create policy sla_policies_write on public.sla_policies
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- responded_at: real first-response timestamp, stamped automatically the
-- first time a task leaves 'new'. Without this, "average response time"
-- (asked for explicitly by this phase's own reporting requirement) would
-- have no honest source - it would just be a copy of resolution time, which
-- measures something else entirely. Doesn't backfill existing tasks; those
-- simply show no response time, which is the truthful state.
-- ============================================================
alter table public.tasks
  add column if not exists responded_at timestamptz;

create function public.set_responded_at()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'new' and new.status != 'new' and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger tasks_set_responded_at
  before update on public.tasks
  for each row execute function public.set_responded_at();

-- ============================================================
-- per-task SLA status - reused by both the task page badge and the
-- breached-tasks list below. Returns no row if the task's organization has
-- no active policy for its priority (nothing to violate).
-- ============================================================
create or replace function public.task_sla(p_task_id uuid)
returns table (
  policy_name text,
  response_minutes integer,
  resolution_minutes integer,
  response_due timestamptz,
  resolution_due timestamptz,
  responded boolean,
  response_breached boolean,
  resolution_breached boolean,
  remaining_seconds numeric,
  sla_state text
)
language sql
security invoker
stable
as $$
  with base as (
    select
      t.status, t.created_at, t.updated_at, t.responded_at,
      p.name as policy_name,
      p.response_minutes, p.resolution_minutes,
      t.created_at + (p.response_minutes || ' minutes')::interval as response_due,
      t.created_at + (p.resolution_minutes || ' minutes')::interval as resolution_due
    from public.tasks t
    join public.sla_policies p
      on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
    where t.id = p_task_id
  )
  select
    policy_name, response_minutes, resolution_minutes, response_due, resolution_due,
    (responded_at is not null) as responded,
    (
      (responded_at is null and now() > response_due)
      or (responded_at is not null and responded_at > response_due)
    ) as response_breached,
    (
      (status not in ('completed', 'cancelled') and now() > resolution_due)
      or (status = 'completed' and updated_at > resolution_due)
    ) as resolution_breached,
    extract(epoch from (resolution_due - now())) as remaining_seconds,
    case
      when status = 'cancelled' then 'not_applicable'
      when status = 'completed' and updated_at <= resolution_due then 'on_time'
      when status = 'completed' then 'breached'
      when now() > resolution_due then 'breached'
      when now() > resolution_due - (resolution_due - created_at) * 0.2 then 'near_due'
      else 'on_time'
    end as sla_state
  from base;
$$;

-- ============================================================
-- org/department/employee-level SLA report: compliance rate, breached
-- count, average response/resolution time - one function, filterable,
-- reused later by any Dashboard/Reports phase the same way report_* and
-- employee_workload() already are.
-- ============================================================
create or replace function public.sla_report(
  p_department_id uuid default null,
  p_user_id uuid default null
)
returns table (
  total_count bigint,
  breached_count bigint,
  compliance_rate numeric,
  avg_response_minutes numeric,
  avg_resolution_hours numeric
)
language sql
security invoker
stable
as $$
  with scored as (
    select
      t.status, t.created_at, t.updated_at, t.responded_at,
      t.created_at + (p.resolution_minutes || ' minutes')::interval as resolution_due
    from public.tasks t
    join public.sla_policies p
      on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
    where t.status != 'cancelled'
      and (p_department_id is null or t.assigned_to in (select id from public.users where department_id = p_department_id))
      and (p_user_id is null or t.assigned_to = p_user_id)
  ),
  flagged as (
    select
      *,
      (status = 'completed' and updated_at > resolution_due)
        or (status != 'completed' and now() > resolution_due) as is_breached
    from scored
  )
  select
    count(*) as total_count,
    count(*) filter (where is_breached) as breached_count,
    case when count(*) = 0 then 100 else
      round(100.0 * count(*) filter (where not is_breached) / count(*), 1)
    end as compliance_rate,
    round(avg(extract(epoch from (responded_at - created_at)) / 60.0) filter (where responded_at is not null), 1) as avg_response_minutes,
    round(avg(extract(epoch from (updated_at - created_at)) / 3600.0) filter (where status = 'completed'), 1) as avg_resolution_hours
  from flagged;
$$;

-- ============================================================
-- breach notifications - same dedupe-by-not-exists shape as
-- send_due_date_reminders() (notifications_and_reports.sql): each breach
-- type fires at most once per task, ever.
-- ============================================================
create function public.notify_sla_breaches()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, task_id, type, message)
  select t.assigned_to, t.id, 'sla_response_breached',
    'تجاوزت المهمة "' || t.title || '" وقت الاستجابة المتفق عليه (SLA)'
  from public.tasks t
  join public.sla_policies p
    on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
  where t.responded_at is null
    and now() > t.created_at + (p.response_minutes || ' minutes')::interval
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id and n.type = 'sla_response_breached'
    );

  insert into public.notifications (user_id, task_id, type, message)
  select t.assigned_to, t.id, 'sla_resolution_breached',
    'تجاوزت المهمة "' || t.title || '" وقت الإنجاز المتفق عليه (SLA)'
  from public.tasks t
  join public.sla_policies p
    on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
  where t.status not in ('completed', 'cancelled')
    and now() > t.created_at + (p.resolution_minutes || ' minutes')::interval
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id and n.type = 'sla_resolution_breached'
    );
end;
$$;

select cron.schedule(
  'notify-sla-breaches',
  '*/15 * * * *',
  $$select public.notify_sla_breaches()$$
);
