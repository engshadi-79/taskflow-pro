-- MONJEZ V2 — P11: Organization Settings
-- Run after schema.sql, rls.sql, storage.sql, avatars.sql.
--
-- organizations already has an `organizations_update` RLS policy
-- (rls.sql) restricted to super_admin of that org, and it's a plain
-- `for update using (...)` with no column whitelist - unlike users' own
-- role column, there's no privilege-escalation risk in a super_admin
-- freely editing their own organization's settings, so the new columns
-- below need no SECURITY DEFINER wrapper, just a normal `.update()` call
-- from the Server Action.

alter table public.organizations
  add column logo_url text,
  add column timezone text not null default 'Asia/Riyadh',
  add column work_days int[] not null default '{0,1,2,3,4}',
  add column work_start_time time not null default '09:00',
  add column work_end_time time not null default '17:00',
  add column default_task_priority text not null default 'medium' check (
    default_task_priority in ('low', 'medium', 'high', 'urgent')
  ),
  add column default_sla_hours int not null default 24 check (default_sla_hours > 0);

alter table public.organizations
  add constraint organizations_work_days_valid check (work_days <@ array[0,1,2,3,4,5,6]);

-- ============================================================
-- organization_holidays: a list, not a single field, so it's its own
-- table - any role can read (a holiday affects everyone's calendar), only
-- super_admin can manage it
-- ============================================================

create table public.organization_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, holiday_date)
);

create index organization_holidays_org_idx on public.organization_holidays(organization_id, holiday_date);

alter table public.organization_holidays enable row level security;

create policy organization_holidays_select on public.organization_holidays
  for select using (organization_id = public.current_org_id());

create policy organization_holidays_insert on public.organization_holidays
  for insert with check (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy organization_holidays_delete on public.organization_holidays
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- org-logos storage bucket - same shape as avatars.sql: public read (a
-- logo renders in <img> tags across the app, not sensitive), path
-- convention "<organization_id>/<file_name>" so policies can recover the
-- owning org from the object path, write restricted to that org's
-- super_admin
-- ============================================================

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy org_logos_storage_select on storage.objects
  for select using (bucket_id = 'org-logos');

create policy org_logos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_user_role() = 'super_admin'
  );

create policy org_logos_storage_update on storage.objects
  for update using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_user_role() = 'super_admin'
  );

create policy org_logos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_user_role() = 'super_admin'
  );
