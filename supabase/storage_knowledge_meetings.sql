-- TaskFlow Pro (MONJEZ 2.0) — Phase 18 fix: storage policies for knowledge/
-- and meeting attachments.
--
-- uploadKnowledgeAttachment/uploadMeetingAttachment (src/lib/actions/
-- knowledge.ts, meetings.ts) write into the existing 'task-attachments'
-- bucket at "knowledge/<article_id>/..." and "meetings/<meeting_id>/...".
-- The only storage.objects policies that exist for this bucket
-- (supabase/storage.sql) cast (storage.foldername(name))[1] straight to
-- uuid, assuming every object is "<task_id>/...". For these two prefixes
-- that first segment is the literal string "knowledge"/"meetings", not a
-- uuid, so the task policies never match - these uploads/reads were never
-- actually covered by any storage RLS policy. Adding the missing ones here,
-- same shape as task_attachments_storage_*, keyed off the second path
-- segment and reusing the exact same visibility as
-- knowledge_attachments_select/meeting_attachments_select (existence of a
-- readable parent row, which is itself RLS-scoped by
-- knowledge_articles_select/meetings_select).

create policy knowledge_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and exists (
      select 1 from public.knowledge_articles a
      where a.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

create policy knowledge_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and owner = auth.uid()
    and exists (
      select 1 from public.knowledge_articles a
      where a.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

create policy knowledge_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );

create policy meeting_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and exists (
      select 1 from public.meetings m
      where m.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

create policy meeting_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and owner = auth.uid()
    and exists (
      select 1 from public.meetings m
      where m.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

create policy meeting_attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and (owner = auth.uid() or public.current_user_role() = 'super_admin')
  );
