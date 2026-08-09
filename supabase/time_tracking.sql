-- TaskFlow Pro (MONJEZ 2.0) — Phase 07: Time Tracking
-- Run after projects_foundation.sql (task_time_entries already exists with
-- its own RLS from that file - this only adds enforcement plus one small
-- column Time Tracking specifically needs that schema.sql never had).
--
-- "الوقت المخطط" (planned time) has no real column anywhere before this -
-- unlike "estimated hours" in Phase 06 (skipped there because nothing in
-- that phase's own scope needed it), Phase 07 explicitly asks to show
-- planned vs actual vs difference. Faking that number in the UI would be
-- worse than adding one real, nullable column for it, so estimated_hours is
-- added here - genuinely required by this phase's own stated requirement,
-- not invented ahead of need.
alter table public.tasks
  add column if not exists estimated_hours numeric check (estimated_hours is null or estimated_hours >= 0);

-- ============================================================
-- prevent overlapping time sessions for the same user ("لا تسمح بتداخل
-- جلسات زمنية غير منطقية"). One EXCLUDE constraint covers both "two open
-- sessions at once" (an open session's range is [started_at, infinity),
-- which overlaps every other range for that user) and "two closed sessions
-- whose time ranges overlap" - no separate app-level check can fully
-- replace this, since it also blocks a rogue direct API call.
-- ============================================================
create extension if not exists btree_gist;

alter table public.task_time_entries
  add constraint task_time_entries_no_overlap
  exclude using gist (
    user_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz)) with &&
  );

-- ============================================================
-- per-task time summary - actual_seconds counts a currently-running entry
-- up to now(), so "الوقت الفعلي" is live while a timer is running, not
-- just the sum of already-stopped sessions.
-- ============================================================
create or replace function public.task_time_summary(p_task_id uuid)
returns table (actual_seconds numeric, has_running boolean)
language sql
security invoker
stable
as $$
  select
    coalesce(sum(coalesce(duration_seconds, extract(epoch from (now() - started_at)))), 0) as actual_seconds,
    coalesce(bool_or(ended_at is null), false) as has_running
  from public.task_time_entries
  where task_id = p_task_id;
$$;

-- ============================================================
-- manager-facing aggregate: total logged seconds per employee, filterable
-- by department/project/employee/period. SECURITY INVOKER like every
-- report_*/employee_workload() function - RLS on task_time_entries/users
-- does the real scoping, this just aggregates what the caller can see.
-- ============================================================
create or replace function public.time_report(
  p_department_id uuid default null,
  p_project_id uuid default null,
  p_user_id uuid default null,
  p_since date default null,
  p_until date default null
)
returns table (
  user_id uuid,
  full_name text,
  total_seconds numeric,
  entry_count bigint
)
language sql
security invoker
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    coalesce(sum(e.duration_seconds), 0) as total_seconds,
    count(e.id) as entry_count
  from public.users u
  left join public.task_time_entries e on e.user_id = u.id
    and e.ended_at is not null
    and (p_project_id is null or e.task_id in (select id from public.tasks where project_id = p_project_id))
    and (p_since is null or e.started_at::date >= p_since)
    and (p_until is null or e.started_at::date <= p_until)
  where u.is_active
    and (p_department_id is null or u.department_id = p_department_id)
    and (p_user_id is null or u.id = p_user_id)
  group by u.id, u.full_name
  order by total_seconds desc;
$$;
