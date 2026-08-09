-- TaskFlow Pro — additional self-service profile fields.
-- Run this after schema.sql and self_profile_update.sql (no new RLS here;
-- these columns are covered by the existing users_self_update policy,
-- id = auth.uid(), plus the super_admin policy in rls.sql).
--
-- job_title already exists on public.users (schema.sql) - not repeated
-- here, adding it again would either error or silently no-op depending on
-- phrasing, and either way there'd be nothing for this file to actually do
-- for that column.
--
-- Every ADD COLUMN below is IF NOT EXISTS with its constraint inlined on
-- the same clause, so re-running this file is a no-op for any column that
-- already exists - constraint and all, since Postgres skips the whole
-- clause once the column is there. That's the safe pattern
-- self_profile_update.sql's first run should have used for its policy.
alter table public.users
  add column if not exists secondary_email text,
  add column if not exists bio text check (bio is null or char_length(bio) <= 200),
  add column if not exists manager_id uuid references public.users(id) on delete set null;

-- This only decides whether these columns exist and what values they may
-- hold - not who may write them. Exactly like full_name/phone/avatar_url,
-- users_self_update lets any user overwrite these on their OWN row; nothing
-- here stops a plain employee from setting their own manager_id. If that
-- should be an admin-only decision (a reasonable read of "manager_id"),
-- keep it out of any self-service update path in application code, the same
-- way updateOwnProfile deliberately never touches role/department_id/
-- is_active today.
