-- MONJEZ 3.0 P18 — API & Webhooks
-- Closes the recorded gap: only two internal, session-authenticated routes
-- existed (ai/chat, reports/export) - no API-key auth, no outbound
-- webhooks, no public API surface at all. This adds both, scoped
-- deliberately: one real resource (tasks: list + create) via API key, and
-- three real task-lifecycle events (task.created/status_changed/completed)
-- delivered synchronously with HMAC signing - no delivery queue/retry-cron,
-- since this project's Vercel plan (Hobby) caps cron jobs at 2, both
-- already used by P15's scheduled emails. A synchronous best-effort POST at
-- the moment the event fires, logged either way, is the honest scope this
-- platform allows rather than promising retries it can't schedule.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by uuid not null references public.users(id) on delete cascade,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index api_keys_key_hash_idx on public.api_keys(key_hash);
create index api_keys_organization_id_idx on public.api_keys(organization_id);

alter table public.api_keys enable row level security;

-- Same shape as plan_upgrade_requests/organization_holidays: plain RLS,
-- super_admin only, self-service within their own org - no SECURITY
-- DEFINER needed. The actual /api/v1/* routes never go through RLS at all
-- (they use the service-role client and enforce organization_id
-- themselves, exactly like the P15 cron routes already do), so this RLS
-- only governs the in-app "manage my keys" UI.
create policy api_keys_select on public.api_keys
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy api_keys_insert on public.api_keys
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'super_admin'
    and created_by = auth.uid()
  );

create policy api_keys_update on public.api_keys
  for update using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index webhook_endpoints_organization_id_idx on public.webhook_endpoints(organization_id);

alter table public.webhook_endpoints enable row level security;

create policy webhook_endpoints_select on public.webhook_endpoints
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy webhook_endpoints_insert on public.webhook_endpoints
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'super_admin'
    and created_by = auth.uid()
  );

create policy webhook_endpoints_update on public.webhook_endpoints
  for update using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy webhook_endpoints_delete on public.webhook_endpoints
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- A delivery LOG, not a retry queue (see header) - one row per attempt,
-- written immediately after each synchronous POST by the TS dispatcher
-- (src/lib/webhooks/dispatcher.ts). Only that service-role code and the
-- select policy below ever touch this table.
create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null check (status in ('delivered', 'failed')),
  response_status int,
  error text,
  created_at timestamptz not null default now()
);

create index webhook_deliveries_endpoint_id_idx on public.webhook_deliveries(endpoint_id);

alter table public.webhook_deliveries enable row level security;

create policy webhook_deliveries_select on public.webhook_deliveries
  for select using (
    exists (
      select 1 from public.webhook_endpoints e
      where e.id = endpoint_id
        and e.organization_id = public.current_org_id()
        and public.current_user_role() = 'super_admin'
    )
  );
