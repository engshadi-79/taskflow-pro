-- Saved-template library for the Excel/Word converter tool
-- (src/components/dashboard/template-converter.tsx). Lets a user upload a
-- template once and reuse it any time afterward, instead of re-uploading
-- the same file on every conversion. Private bucket + its own dedicated
-- table, following the same shape as report_builder.sql (org-scoped RLS,
-- no SECURITY DEFINER function needed - "save/list/delete a template for
-- my own org" has no cross-org dimension to re-derive).

create table public.saved_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_format text not null check (file_format in ('xlsx', 'docx')),
  template_headers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index saved_templates_organization_id_idx on public.saved_templates(organization_id);

alter table public.saved_templates enable row level security;

create policy saved_templates_select on public.saved_templates
  for select using (organization_id = public.current_org_id());

create policy saved_templates_insert on public.saved_templates
  for insert with check (
    organization_id = public.current_org_id() and created_by = auth.uid()
  );

create policy saved_templates_delete on public.saved_templates
  for delete using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'super_admin')
  );

-- Storage: private bucket, path convention "<organization_id>/<template_id>.<ext>"
-- so policies can recover the owning org straight from the object path (same
-- shape as org-logos.sql's public bucket, kept private here since template
-- files are internal working documents, not something to expose via a bare
-- public URL).
insert into storage.buckets (id, name, public)
values ('report-templates', 'report-templates', false)
on conflict (id) do nothing;

create policy report_templates_storage_select on storage.objects
  for select using (
    bucket_id = 'report-templates'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy report_templates_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'report-templates'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (owner = auth.uid() or owner_id = auth.uid()::text)
  );

create policy report_templates_storage_delete on storage.objects
  for delete using (
    bucket_id = 'report-templates'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );
