-- MONJEZ 3.0 P15 — Email & Scheduled Reports
-- Closes the recorded gap: zero email integration anywhere; 8+ pg_cron jobs
-- exist but every one of them is purely in-system (writes to `notifications`,
-- never leaves Postgres). pg_cron itself cannot call an external email API
-- without pg_net/http (neither extension is enabled in this project, and
-- piping a real API key into raw SQL would break this project's own
-- convention of keeping provider keys as Next.js env vars, never in the
-- database) - so the actual sending happens from a new Vercel Cron ->
-- Next.js API route pair (src/app/api/cron/*), authenticated via
-- CRON_SECRET, using the service-role client. This file only adds what
-- those routes need: opt-in columns on the existing personal preferences
-- table from P12, and one new aggregation function for the weekly report.

-- ============================================================
-- 1) Email opt-ins - both are per-user, so they live on
--    user_notification_preferences (P12) rather than a new table. RLS
--    already scopes this table to user_id = auth.uid(); no change needed
--    there, the two new columns just ride along with the same policies.
-- ============================================================

alter table public.user_notification_preferences
  add column if not exists email_digest_enabled boolean not null default false,
  add column if not exists last_digest_email_at timestamptz,
  add column if not exists weekly_report_email_enabled boolean not null default false,
  add column if not exists last_weekly_report_email_at timestamptz;

-- ============================================================
-- 2) report_weekly_email_summary: the one new piece of report logic this
--    phase needs. The existing report_*/sla_report functions are
--    `security invoker` and rely on current_org_id()/RLS, which only work
--    inside an authenticated request - the cron route runs unattended with
--    the service-role client (bypasses RLS, no auth.uid()), so it needs an
--    explicitly-parameterized equivalent instead.
--
--    SECURITY DEFINER + a caller-supplied p_organization_id is a real
--    cross-tenant data leak if left open to normal client calls - unlike
--    every other cron function in this project (which return void or take
--    no caller-scoping parameter), this one returns another organization's
--    aggregate numbers if invoked with its id. It is therefore explicitly
--    revoked from anon/authenticated and granted to service_role only,
--    right after creation.
-- ============================================================

create or replace function public.report_weekly_email_summary(
  p_organization_id uuid,
  p_department_id uuid default null
)
returns table (
  total_tasks bigint,
  completed_tasks bigint,
  overdue_tasks bigint,
  delay_rate numeric,
  avg_completion_hours numeric,
  sla_compliance_rate numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with scoped_tasks as (
    select t.*
    from public.tasks t
    where t.organization_id = p_organization_id
      and t.status != 'cancelled'
      and t.updated_at >= now() - interval '7 days'
      and (p_department_id is null or t.assigned_to in (
        select id from public.users where department_id = p_department_id
      ))
  ),
  sla_scoped as (
    select
      t.status, t.created_at, t.updated_at,
      t.created_at + (p.resolution_minutes || ' minutes')::interval as resolution_due
    from public.tasks t
    join public.sla_policies p
      on p.organization_id = t.organization_id and p.priority = t.priority and p.is_active
    where t.organization_id = p_organization_id
      and t.status != 'cancelled'
      and t.created_at >= now() - interval '7 days'
      and (p_department_id is null or t.assigned_to in (
        select id from public.users where department_id = p_department_id
      ))
  ),
  sla_flagged as (
    select *,
      (status = 'completed' and updated_at > resolution_due)
        or (status != 'completed' and now() > resolution_due) as is_breached
    from sla_scoped
  )
  select
    (select count(*) from scoped_tasks),
    (select count(*) from scoped_tasks where status = 'completed'),
    (select count(*) from scoped_tasks where status = 'overdue'),
    (select case when count(*) = 0 then 0 else
      round(100.0 * count(*) filter (where status = 'overdue') / count(*), 1)
    end from scoped_tasks),
    (select round(avg(extract(epoch from (updated_at - created_at)) / 3600.0), 1)
      from scoped_tasks where status = 'completed'),
    (select case when count(*) = 0 then 100 else
      round(100.0 * count(*) filter (where not is_breached) / count(*), 1)
    end from sla_flagged);
$$;

revoke execute on function public.report_weekly_email_summary(uuid, uuid) from public;
revoke execute on function public.report_weekly_email_summary(uuid, uuid) from anon;
revoke execute on function public.report_weekly_email_summary(uuid, uuid) from authenticated;
grant execute on function public.report_weekly_email_summary(uuid, uuid) to service_role;
