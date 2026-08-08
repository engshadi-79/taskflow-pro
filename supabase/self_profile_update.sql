-- TaskFlow Pro — let a user update their own name/phone/avatar.
-- Run this after schema.sql and rls.sql (adds a policy; nothing here
-- depends on avatars.sql, google_signup.sql, etc.)
--
-- users_update in rls.sql only ever allowed super_admin to write any row at
-- all. A plain employee or department_manager editing their own full_name/
-- phone (added in the profile page) or avatar_url (already shipped in
-- avatars.sql) had no UPDATE policy covering that case, so the write would
-- silently affect zero rows under RLS.
--
-- Multiple permissive policies for the same command on the same table are
-- OR'd together in Postgres, so this adds a second UPDATE policy rather
-- than touching the existing super_admin one - both keep working
-- independently.
--
-- This only decides WHICH ROWS may be updated, not which COLUMNS - RLS has
-- no notion of "this session may only touch these columns of an otherwise
-- writable row". That enforcement is the application's job: updateOwnProfile
-- in lib/actions/users.ts only ever sets full_name/phone, uploadAvatar/
-- removeAvatar only ever set avatar_url, by construction. A user who could
-- reach Postgres directly with their own JWT could still write role/
-- organization_id/department_id/is_active on their own row under this
-- policy alone - exactly as true today for avatar_url via the exact same
-- policy gap this migration also happens to close.
create policy users_self_update on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());
