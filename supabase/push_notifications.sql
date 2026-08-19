-- Real device push notifications (arrive even with the app fully closed).
--
-- Delivery path: a Supabase Database Webhook (configured in the dashboard,
-- not here - see the setup instructions given alongside this file) fires on
-- every INSERT into public.notifications and calls
-- /api/webhooks/notification-created, which looks up this table and sends a
-- Web Push message per stored subscription. This mirrors the project's
-- existing convention of never calling external HTTP from inside Postgres
-- (see email_scheduled_reports_v3.sql) - the webhook is Supabase's own
-- managed feature, not a raw pg_net/trigger call written here.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on push_subscriptions;
create policy push_subscriptions_insert on push_subscriptions
  for insert with check (
    user_id = auth.uid() and organization_id = current_org_id()
  );

drop policy if exists push_subscriptions_delete on push_subscriptions;
create policy push_subscriptions_delete on push_subscriptions
  for delete using (user_id = auth.uid());

-- No update policy: a subscription is replaced (delete + insert), never
-- edited in place - the endpoint is what the browser gave us, unique per
-- device/browser install.
