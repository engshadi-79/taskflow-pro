-- MONJEZ V2 — P06: add the missing `priority` field to projects.
-- Reuses the exact same enum tasks.priority already uses (rls.sql/schema.sql)
-- rather than inventing a second priority vocabulary.
alter table public.projects
  add column priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent'));
