-- TaskFlow Pro — Phase 3: Storage bucket for task attachments
-- Run this after schema.sql and rls.sql.
--
-- Upload convention: files are stored at "<task_id>/<file_name>" inside the
-- 'task-attachments' bucket, so policies can recover the task id from the
-- object path and reuse the same visibility rules as the tasks table.

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy task_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.tasks t
      where t.id = (storage.foldername(name))[1]::uuid
    )
  );

create policy task_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = (storage.foldername(name))[1]::uuid
    )
  );

create policy task_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );
