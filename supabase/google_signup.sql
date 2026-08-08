-- TaskFlow Pro — self-service sign-up via "Continue with Google".
-- Run this after schema.sql AND avatars.sql (it references the avatar_url
-- column that migration adds; it replaces schema.sql's handle_new_user
-- function, the trigger binding on auth.users is untouched).
--
-- The app was invite-only until now: every public.users row came from an
-- admin calling admin.createUser() with organization_id/role/department_id
-- set in user_metadata, and handle_new_user() just copied that metadata
-- across. A brand-new Google sign-in has none of that - Supabase sets
-- raw_user_meta_data from whatever Google returns (full_name/name,
-- avatar_url/picture), never organization_id. Inserting a NULL into
-- organization_id would violate its NOT NULL constraint and abort the
-- whole sign-up with a generic "Database error saving new user".
--
-- Decision: a self-service Google sign-up joins the existing organization
-- (the oldest one on record - in practice the only one, since this app has
-- always been single-tenant in use) as a plain employee. It does NOT spin
-- up a new organization for itself; an admin-created account keeps taking
-- the original path unchanged, with whatever role/org was assigned to it.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_org_id uuid;
  org_id uuid;
  display_name text;
begin
  meta_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  if meta_org_id is not null then
    org_id := meta_org_id;
  else
    select id into org_id from public.organizations order by created_at asc limit 1;

    if org_id is null then
      -- fresh install with no organization at all yet: bootstrap one rather
      -- than fail, since organization_id has nowhere valid to point.
      insert into public.organizations (name)
      values (display_name || ' - مؤسسة جديدة')
      returning id into org_id;
    end if;
  end if;

  insert into public.users (
    id, organization_id, full_name, email, phone, role, department_id,
    job_title, avatar_url
  )
  values (
    new.id,
    org_id,
    display_name,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    (new.raw_user_meta_data->>'department_id')::uuid,
    new.raw_user_meta_data->>'job_title',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;
