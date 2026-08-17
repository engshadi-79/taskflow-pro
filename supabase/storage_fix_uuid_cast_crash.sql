-- Fix: storage.objects RLS crash on any shared-bucket prefix other than a
-- plain task attachment.
--
-- Postgres evaluates every permissive policy that applies to a
-- storage.objects operation and OR-combines the results together - but if
-- evaluating one policy's expression raises an exception, the whole
-- statement aborts even when a different policy would have granted access.
-- task_attachments_storage_select/insert (storage.sql) unconditionally cast
-- (storage.foldername(name))[1] to uuid with no prefix guard, so ANY
-- upload/read under a "chat/", "knowledge/", "meetings/", or "comments/"
-- prefix in the shared 'task-attachments' bucket crashed with
-- "invalid input syntax for type uuid: <prefix>" the instant Postgres
-- evaluated that policy - breaking every attachment feature sharing this
-- bucket except plain task attachments themselves (reported live via the
-- internal chat feature, but this affects knowledge/meeting/comment
-- attachments identically).
--
-- Fix: a small helper that returns null instead of raising on a non-uuid
-- string, used everywhere a folder segment gets cast to uuid on this bucket.
-- Run this once against the existing database; it's idempotent.

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

-- storage.sql: plain task attachments ("<task_id>/<file>")
drop policy if exists task_attachments_storage_select on storage.objects;
create policy task_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.tasks t
      where t.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

drop policy if exists task_attachments_storage_insert on storage.objects;
create policy task_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and owner = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = public.try_uuid((storage.foldername(name))[1])
    )
  );

-- storage_knowledge_meetings.sql: "knowledge/<id>/<file>", "meetings/<id>/<file>"
drop policy if exists knowledge_attachments_storage_select on storage.objects;
create policy knowledge_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'knowledge'
    and exists (
      select 1 from public.knowledge_articles a
      where a.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists knowledge_attachments_storage_insert on storage.objects;
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

drop policy if exists meeting_attachments_storage_select on storage.objects;
create policy meeting_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'meetings'
    and exists (
      select 1 from public.meetings m
      where m.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists meeting_attachments_storage_insert on storage.objects;
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

-- task_comments_v2.sql: "comments/<comment_id>/<file>"
drop policy if exists comment_attachments_storage_select on storage.objects;
create policy comment_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and exists (
      select 1 from public.task_comments c where c.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

drop policy if exists comment_attachments_storage_insert on storage.objects;
create policy comment_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'comments'
    and owner = auth.uid()
    and exists (
      select 1 from public.task_comments c where c.id = public.try_uuid((storage.foldername(name))[2])
    )
  );

-- internal_chat.sql: "chat/<conversation_id>/<file>"
drop policy if exists chat_attachments_storage_select on storage.objects;
create policy chat_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[2]))
  );

drop policy if exists chat_attachments_storage_insert on storage.objects;
create policy chat_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and owner = auth.uid()
    and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[2]))
  );
