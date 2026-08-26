-- P16 — Invite a colleague into an existing organization.
--
-- Today there are only two ways into an org: "Continue with Google" with
-- no invite (joins the oldest org, is_active = false until a super_admin
-- approves - google_signup.sql), or email/password self-signup which
-- always creates a brand new org (claim_new_organization,
-- saas_multi_tenant_v3.sql). Neither lets someone join a *specific*
-- existing org without manual after-the-fact approval.
--
-- This adds a shareable invite code per organization plus a redemption RPC
-- that reuses claim_new_organization's own architecture: a separate
-- SECURITY DEFINER call made right after sign-in completes (from
-- /auth/callback and signUpWithInvite), not a change to handle_new_user()
-- itself - the "zero orgs -> create new org" bootstrapping logic is
-- untouched, this is a parallel path.

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('employee', 'department_manager')),
  department_id uuid references public.departments(id) on delete set null,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_invites_code_idx on public.organization_invites(code);

alter table public.organization_invites enable row level security;

-- Same shape as organization_holidays (P11): plain RLS is enough for
-- managing an org's own invites, no SECURITY DEFINER needed here.
create policy organization_invites_select on public.organization_invites
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy organization_invites_insert on public.organization_invites
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'super_admin'
    and created_by = auth.uid()
  );

create policy organization_invites_delete on public.organization_invites
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- Redemption can't go through RLS - the caller just signed in and their
-- current_org_id() is the oldest org (handle_new_user()'s default landing
-- spot), not the invite's org, and they're not that org's super_admin.
-- Same shape as claim_new_organization() in saas_multi_tenant_v3.sql.
create or replace function public.redeem_organization_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  invite record;
  is_pending boolean;
begin
  select * into invite
  from public.organization_invites
  where code = p_code
    and revoked_at is null
    and expires_at > now()
    and (max_uses is null or use_count < max_uses);

  if invite is null then
    raise exception 'رابط الدعوة غير صالح أو منتهي الصلاحية';
  end if;

  -- Only a still-pending self-signup account may redeem an invite - same
  -- guard and same reasoning as claim_new_organization(): an already-
  -- approved employee already has a real org/role, and re-running this
  -- after a successful redemption is a safe no-op (is_active is true by
  -- then, so is_pending is false and this exception fires instead of a
  -- second silent move).
  select (is_active = false) into is_pending from public.users where id = caller_id;
  if is_pending is not true then
    raise exception 'هذا الحساب غير مؤهَّل لاستخدام رابط دعوة';
  end if;

  update public.users
  set organization_id = invite.organization_id,
      role = invite.role,
      department_id = invite.department_id,
      is_active = true
  where id = caller_id;

  update public.organization_invites set use_count = use_count + 1 where id = invite.id;

  return invite.organization_id;
end;
$$;
