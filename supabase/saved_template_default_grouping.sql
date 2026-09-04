-- Lets a saved template remember its own default grouping columns (e.g.
-- "المسار"/"المجموعة" for an attendance sheet grouped by track+group), so
-- selecting that template pre-fills the converter's own grouping dropdowns
-- instead of the user re-picking the same columns on every conversion.
-- Raw data-file column names, same values already accepted by
-- fillXlsxTemplate/fillDocxTemplate's own groupByColumns option - not
-- template headers, so no FK/check against template_headers is meaningful
-- here (the uploaded data file's own headers vary conversion to conversion).

alter table public.saved_templates
  add column default_group_by_columns text[];

-- No update policy existed at all before this - saveTemplate/deleteSavedTemplate
-- only ever needed insert/delete. Same ownership shape as the existing delete
-- policy (the template's own creator, or a super_admin).
create policy saved_templates_update on public.saved_templates
  for update using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'super_admin')
  )
  with check (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'super_admin')
  );
