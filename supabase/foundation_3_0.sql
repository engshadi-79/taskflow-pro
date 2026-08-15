-- MONJEZ 3.0 — P01: Foundation & Architecture 3.0
-- Run after schema.sql, rls.sql.
--
-- Two small generic tables backing the new src/lib/foundation/idempotency.ts
-- and src/lib/foundation/rate-limit.ts services. Both are deliberately
-- domain-agnostic (a bucket/key string, not a foreign key to any specific
-- feature table) so every future Server Action across every domain
-- (tasks/requests/workflows/notifications/...) can reuse the exact same
-- two tables instead of each phase inventing its own dedupe/throttle
-- table, per this phase's own instruction to build shared, reusable
-- infrastructure rather than per-feature one-offs.
--
-- Audit logging itself needs NO new table - src/lib/foundation/audit.ts
-- writes into the existing public.activity_log (schema.sql), which was
-- already generic (organization_id/user_id/action_type/entity_type/
-- entity_id/description) but only ever written to by one SQL trigger
-- (task activity). It's now a real service any Server Action can call.

-- ============================================================
-- idempotency_keys — claims a client-supplied key before a sensitive or
-- cron-triggered mutation runs; a second attempt with the same key (double
-- form submit, a cron retry after a timeout) sees the row already exists
-- and skips re-executing instead of duplicating the effect.
-- ============================================================

create table public.idempotency_keys (
  key text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index idempotency_keys_expires_at_idx on public.idempotency_keys(expires_at);

alter table public.idempotency_keys enable row level security;

create policy idempotency_keys_select on public.idempotency_keys
  for select using (organization_id = public.current_org_id());

create policy idempotency_keys_insert on public.idempotency_keys
  for insert with check (organization_id = public.current_org_id());

create function public.cleanup_expired_idempotency_keys()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.idempotency_keys where expires_at < now();
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-expired-idempotency-keys',
  '0 * * * *',
  $$select public.cleanup_expired_idempotency_keys()$$
);

-- ============================================================
-- rate_limit_hits — one row per attempt against a named bucket (e.g.
-- "admin_notification_send:<user_id>"); the service counts rows in the
-- relevant time window rather than maintaining a running counter, the
-- same approach /api/ai/chat already used ad hoc against ai_interactions
-- before this shared table existed.
-- ============================================================

create table public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_idx on public.rate_limit_hits(bucket_key, created_at);

alter table public.rate_limit_hits enable row level security;

create policy rate_limit_hits_select on public.rate_limit_hits
  for select using (organization_id = public.current_org_id());

create policy rate_limit_hits_insert on public.rate_limit_hits
  for insert with check (organization_id = public.current_org_id());

create function public.cleanup_old_rate_limit_hits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_hits where created_at < now() - interval '1 day';
$$;

select cron.schedule(
  'cleanup-old-rate-limit-hits',
  '0 * * * *',
  $$select public.cleanup_old_rate_limit_hits()$$
);
