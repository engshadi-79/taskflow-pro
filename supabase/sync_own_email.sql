-- Login-email changes (self-service, from the user menu) go through Supabase
-- Auth's own confirmation flow and land back on /auth/callback like every
-- other auth code exchange (OAuth, password reset). At that point
-- auth.users.email may now differ from the cached public.users.email column,
-- but fix_self_profile_update.sql already removed the broad self-update RLS
-- policy, so the route handler can't write that column directly even with
-- the user's own session - same whitelisted-function pattern as
-- update_own_profile. Called unconditionally after every successful
-- exchange; writing back an unchanged value is a harmless no-op.
create or replace function public.sync_own_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set email = p_email where id = auth.uid();
end;
$$;

revoke all on function public.sync_own_email(text) from public;
grant execute on function public.sync_own_email(text) to authenticated;
