-- TaskFlow Pro — self-service sign-up via "Continue with Google", gated by
-- admin approval.
-- Run this after schema.sql AND avatars.sql (it references the avatar_url
-- column that migration adds; it replaces schema.sql's handle_new_user
-- function, the trigger binding on auth.users is untouched).
--
-- The app was invite-only until now: every public.users row came from an
-- admin calling admin.createUser() with organization_id/role/department_id
-- set in user_metadata, and handle_new_user() just copied that metadata
-- across, always active. A brand-new Google sign-in has none of that -
-- Supabase sets raw_user_meta_data from whatever Google returns
-- (full_name/name, avatar_url/picture), never organization_id. Inserting a
-- NULL into organization_id would violate its NOT NULL constraint and abort
-- the whole sign-up with a generic "Database error saving new user".
--
-- Decision: a self-service Google sign-up joins the existing organization
-- (the oldest one on record - in practice the only one, since this app has
-- always been used by a single company despite the schema being
-- multi-tenant-capable) with role 'employee', but INACTIVE until a
-- super_admin approves it - every super_admin in that organization gets a
-- notification and can approve (activate) or reject (delete) it from the
-- Team page. An admin-created account is unaffected: it still takes its
-- organization_id, role and active status straight from the metadata an
-- admin set at invite time, and is active immediately.
--
-- Enforcement is not just page-routing (dashboard/layout.tsx redirects an
-- inactive profile to /pending-approval) - that alone would only hide the
-- UI while leaving the same access any other 'employee' has open to a
-- direct API call. current_org_id() now resolves to NULL for an inactive
-- user, which is ANDed into nearly every RLS policy in rls.sql, so a
-- pending account cannot read or write anything outside its own users row
-- (kept reachable so the pending-approval page can render their name).

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
  is_self_signup boolean;
begin
  meta_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );
  is_self_signup := meta_org_id is null;

  if not is_self_signup then
    org_id := meta_org_id;
  else
    select id into org_id from public.organizations order by created_at asc limit 1;

    if org_id is null then
      -- fresh install with no organization at all yet: bootstrap one and
      -- activate this first-ever user immediately as its admin, since
      -- nobody else could exist to approve them.
      insert into public.organizations (name)
      values (display_name || ' - مؤسسة جديدة')
      returning id into org_id;
      is_self_signup := false;
    end if;
  end if;

  insert into public.users (
    id, organization_id, full_name, email, phone, role, department_id,
    job_title, avatar_url, is_active
  )
  values (
    new.id,
    org_id,
    display_name,
    new.email,
    new.raw_user_meta_data->>'phone',
    case when is_self_signup then 'employee' else coalesce(new.raw_user_meta_data->>'role', 'employee') end,
    (new.raw_user_meta_data->>'department_id')::uuid,
    new.raw_user_meta_data->>'job_title',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    not is_self_signup
  );
  return new;
end;
$$;

-- notify every super_admin in the organization when a self-signup lands
-- inactive, awaiting their approval
create function public.notify_pending_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = false then
    insert into public.notifications (user_id, task_id, type, message)
    select id, null, 'user_pending_approval',
           'مستخدم جديد ينتظر الموافقة: ' || new.full_name || ' (' || new.email || ')'
    from public.users
    where organization_id = new.organization_id and role = 'super_admin';
  end if;
  return new;
end;
$$;

create trigger on_user_created_notify_pending
  after insert on public.users
  for each row execute function public.notify_pending_user_signup();

-- RLS enforcement: current_org_id() is used throughout rls.sql, so making it
-- resolve to NULL for an inactive user locks them out of every org-scoped
-- table in one place, rather than editing every policy individually.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.users where id = auth.uid() and is_active = true;
$$;

-- users_select relied on current_org_id() matching before even considering
-- "or id = auth.uid()", so an inactive user's own row - needed to render
-- the pending-approval page - would have gone unreadable along with
-- everything else. Split "read your own row" out so it no longer depends
-- on current_org_id() at all.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (
    id = auth.uid()
    or (
      organization_id = public.current_org_id() and (
        public.current_user_role() = 'super_admin'
        or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
      )
    )
  );
