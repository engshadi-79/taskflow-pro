-- Native push delivery for the React Native app (as opposed to the Web Push
-- path in push_notifications.sql, used by the PWA/TWA build). Same webhook
-- (/api/webhooks/notification-created) fans out to both tables per user, so
-- a user gets exactly one push regardless of which surface they installed.

create table if not exists expo_push_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists expo_push_tokens_user_id_idx on expo_push_tokens(user_id);

alter table expo_push_tokens enable row level security;

drop policy if exists expo_push_tokens_select on expo_push_tokens;
create policy expo_push_tokens_select on expo_push_tokens
  for select using (user_id = auth.uid());

drop policy if exists expo_push_tokens_insert on expo_push_tokens;
create policy expo_push_tokens_insert on expo_push_tokens
  for insert with check (
    user_id = auth.uid() and organization_id = current_org_id()
  );

drop policy if exists expo_push_tokens_update on expo_push_tokens;
create policy expo_push_tokens_update on expo_push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists expo_push_tokens_delete on expo_push_tokens;
create policy expo_push_tokens_delete on expo_push_tokens
  for delete using (user_id = auth.uid());
