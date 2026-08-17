-- Fix: every attachment upload rejected with
-- "new row violates row-level security policy".
--
-- Every attachment insert/delete policy in this project (task, chat,
-- knowledge, meeting, task-comment, and workflow-request attachments) gates
-- on `owner = auth.uid()`, matching against storage.objects' legacy `owner`
-- (uuid) column. Modern Supabase Storage populates the newer `owner_id`
-- (text) column instead and leaves `owner` null for uploads made through
-- the JS client - so this check has never actually been true, and every
-- insert into any of these bucket prefixes has been rejected outright.
-- (avatars.sql sidesteps this entirely by encoding the owner in the object
-- path instead of relying on this column, which is why avatar uploads were
-- unaffected and this went unnoticed until now.)
--
-- Fix: also accept `owner_id = auth.uid()::text`, so the check passes
-- regardless of which column this Supabase instance actually populates.
-- Run this once against the existing database; it's idempotent.

drop policy if exists task_attachments_storage_insert on storage.objects;
create policy task_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and exists (
      select 1 from public.tasks t
      where t.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

drop policy if exists task_attachments_storage_delete on storage.objects;
create policy task_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );

drop policy if exists knowledge_attachments_storage_insert on storage.objects;
create policy knowledge_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and exists (
      select 1 from public.knowledge_articles a
      where a.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists knowledge_attachments_storage_delete on storage.objects;
create policy knowledge_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );

drop policy if exists meeting_attachments_storage_insert on storage.objects;
create policy meeting_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and exists (
      select 1 from public.meetings m
      where m.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists meeting_attachments_storage_delete on storage.objects;
create policy meeting_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );

drop policy if exists comment_attachments_storage_insert on storage.objects;
create policy comment_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and exists (
      select 1 from public.task_comments c where c.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists comment_attachments_storage_delete on storage.objects;
create policy comment_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );

drop policy if exists chat_attachments_storage_insert on storage.objects;
create policy chat_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[2]))
  );

drop policy if exists chat_attachments_storage_delete on storage.objects;
create policy chat_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
  );

drop policy if exists workflow_request_attachments_storage_select on storage.objects;
create policy workflow_request_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'workflow-request-attachments'
    and exists (
      select 1 from public.workflow_requests r
      where r.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

drop policy if exists workflow_request_attachments_storage_insert on storage.objects;
create policy workflow_request_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'workflow-request-attachments'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and exists (
      select 1 from public.workflow_requests r
      where r.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

drop policy if exists workflow_request_attachments_storage_delete on storage.objects;
create policy workflow_request_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'workflow-request-attachments'
    and (owner = auth.uid() or owner_id = auth.uid()::text or public.current_user_role() = 'super_admin')
  );
