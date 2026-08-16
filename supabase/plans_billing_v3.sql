-- MONJEZ 3.0 P17 — Plans & Billing (real limits, no payment processor)
-- Closes the recorded gap: organizations.plan_type exists but is never
-- read/checked anywhere - a structural placeholder with zero behavioral
-- effect. Per the user's explicit choice, this phase adds REAL enforcement
-- (a seat cap on the free plan) without any payment integration - upgrading
-- is a manual, logged request a super_admin submits in-app, not a checkout
-- flow. The seat limit itself is a plain TS constant (src/lib/plans.ts),
-- not a new table - two plan tiers with one limit each doesn't need a
-- configurable-limits table yet.

create table public.plan_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'resolved')),
  created_at timestamptz not null default now()
);

create index plan_upgrade_requests_organization_id_idx on public.plan_upgrade_requests(organization_id);

alter table public.plan_upgrade_requests enable row level security;

-- Same shape as organization_holidays (P11): plain RLS is enough here,
-- no SECURITY DEFINER function needed - "record a request for my own org
-- as myself" has no cross-user/cross-org dimension to re-derive.
create policy plan_upgrade_requests_select on public.plan_upgrade_requests
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy plan_upgrade_requests_insert on public.plan_upgrade_requests
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'super_admin'
    and requested_by = auth.uid()
  );
