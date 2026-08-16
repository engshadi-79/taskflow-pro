-- MONJEZ 3.0 P16 — SaaS Multi-Tenant: real self-service organization creation
-- Closes the recorded gap: the multi-tenant architecture (organization_id +
-- RLS everywhere) is real and load-bearing, but self-signup never actually
-- creates a new organization in practice - handle_new_user() (google_signup.sql)
-- always joins the single oldest organization and leaves the account
-- is_active = false pending a super_admin's manual approval. Real new-org
-- creation only ever fired in the (practically unreachable) case of zero
-- organizations existing at all.
--
-- This does not touch handle_new_user() or the pending-approval flow at
-- all - "join an existing org, wait for approval" remains exactly as it
-- was and is still the default. It adds one new, narrow, self-service
-- path: a still-pending self-signup account can promote itself into being
-- the founding super_admin of a brand new organization instead of waiting.

create or replace function public.claim_new_organization(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  is_pending boolean;
  new_org_id uuid;
  clean_name text := trim(coalesce(p_org_name, ''));
begin
  if clean_name = '' then
    raise exception 'اسم المؤسسة مطلوب';
  end if;

  select (is_active = false) into is_pending
  from public.users
  where id = caller_id;

  -- Only a still-pending self-signup account may take this path - an
  -- already-approved employee/manager has a real organization and role
  -- already; letting them "claim" a new one via this onboarding-only
  -- action would be confusing self-service scope creep, not a security
  -- hole (they'd only ever land in a brand new, empty org - never gain
  -- access to anyone else's data), but there's no legitimate reason to
  -- allow it either. Re-running this after a successful first call is
  -- always a safe no-op: is_active is true by then, so is_pending is
  -- false and this exception fires instead of creating a second org.
  if is_pending is not true then
    raise exception 'هذا الحساب غير مؤهَّل لإنشاء مؤسسة جديدة';
  end if;

  insert into public.organizations (name) values (clean_name)
  returning id into new_org_id;

  -- Moves the caller out of the oldest org's pending list entirely and
  -- into sole ownership of the fresh one. department_id is cleared since
  -- the old org's department (if any was set) doesn't exist in the new
  -- org. Every existing "seed defaults for a newly-created organization"
  -- trigger (role_permissions from P02, workflow_templates from P05,
  -- automation_rule_templates from P11) fires normally off the insert
  -- above - nothing extra needed here to bootstrap them.
  update public.users
  set organization_id = new_org_id,
      role = 'super_admin',
      is_active = true,
      department_id = null
  where id = caller_id;

  return new_org_id;
end;
$$;
