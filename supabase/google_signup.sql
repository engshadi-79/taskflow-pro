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
-- So this adds a second path: when organization_id is absent from the
-- metadata, treat this as a fresh tenant signing up - create a new
-- organization on the spot and make this user its super_admin, since
-- nothing else in this multi-tenant schema can own their rows otherwise.
-- Existing invited accounts are completely unaffected: an admin-created
-- user always has organization_id in its metadata, so it keeps taking the
-- original path with its assigned role untouched.

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
    insert into public.organizations (name)
    values (display_name || ' - مؤسسة جديدة')
    returning id into org_id;
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
    case
      when meta_org_id is null then 'super_admin'
      else coalesce(new.raw_user_meta_data->>'role', 'employee')
    end,
    (new.raw_user_meta_data->>'department_id')::uuid,
    new.raw_user_meta_data->>'job_title',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;
