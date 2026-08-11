-- MONJEZ V2 — P08: Attachments & Documents.
-- Run after schema.sql, rls.sql.
--
-- task_attachments had upload/download/delete but no size on record, no
-- versioning, and no server-side type/size limit (uploadAttachment in
-- src/lib/actions/tasks.ts accepted literally any file of any size -
-- avatar upload already had both checks, task attachments never did).
--
-- Versioning model: original_attachment_id is null for the first upload of
-- a document and points back at that first row for every later version -
-- old versions are never deleted or overwritten, only superseded, so the
-- full history stays queryable. Same RLS as before covers every version
-- automatically (visibility follows the parent task, unchanged).

alter table public.task_attachments
  add column file_size bigint,
  add column version_number int not null default 1,
  add column original_attachment_id uuid references public.task_attachments(id) on delete set null;
