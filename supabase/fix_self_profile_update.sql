-- MONJEZ V2 — P02 critical fix: users_self_update allowed writing ANY
-- column on a user's own row (RLS only restricts which ROWS, never which
-- COLUMNS - self_profile_update.sql's own comment already documented this
-- gap). A direct REST call with a normal user's own JWT
-- (PATCH /rest/v1/users?id=eq.<self> {"role":"super_admin"}) could
-- self-promote to super_admin, or rewrite department_id/organization_id/
-- is_active, entirely bypassing updateOwnProfile's field whitelist since
-- that whitelist only exists in application code, not in the database.
--
-- Fix: remove the broad self-row policy and replace every self-edit path
-- with SECURITY DEFINER functions that only ever write specific columns -
-- same pattern already used elsewhere in this project
-- (submit_workflow_request, update_department_employee,
-- convert_minute_to_task) instead of inventing a new permission mechanism.
-- Two functions, not one combined one: full_name/phone/secondary_email/bio
-- are edited together on the profile form, avatar_url is edited
-- independently (upload/remove) - a single function covering all five
-- would need a "don't touch this field" sentinel that's ambiguous for
-- columns users can legitimately clear to null (phone/secondary_email/bio).
--
-- super_admin's separate ability to edit OTHER users' role/department_id
-- (users_update in rls.sql, used by updateEmployee) is untouched - that
-- policy was never the problem.

drop policy if exists users_self_update on public.users;

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_secondary_email text,
  p_bio text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set full_name = p_full_name, phone = p_phone, secondary_email = p_secondary_email, bio = p_bio
  where id = auth.uid();
end;
$$;

create or replace function public.update_own_avatar(p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set avatar_url = p_avatar_url where id = auth.uid();
end;
$$;

revoke all on function public.update_own_profile(text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, text) to authenticated;

revoke all on function public.update_own_avatar(text) from public;
grant execute on function public.update_own_avatar(text) to authenticated;
