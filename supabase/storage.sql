-- TaskFlow Pro — Phase 3: Storage bucket for task attachments
-- Run this after schema.sql and rls.sql.
--
-- Upload convention: files are stored at "<task_id>/<file_name>" inside the
-- 'task-attachments' bucket, so policies can recover the task id from the
-- object path and reuse the same visibility rules as the tasks table.

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- try_uuid: returns null instead of raising on a non-uuid string. Required
-- here because Postgres evaluates every permissive policy on storage.objects
-- and OR-combines the results - other features share this bucket under
-- literal prefixes ("knowledge/", "meetings/", "chat/", "comments/"), and a
-- naked ::uuid cast on segment [1] would crash the whole query the instant
-- any of those paths got evaluated against this policy (see
-- storage_fix_uuid_cast_crash.sql for the full incident).
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy task_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.tasks t
      where t.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

create policy task_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

create policy task_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );
