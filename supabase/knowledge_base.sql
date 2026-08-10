-- TaskFlow Pro (MONJEZ 2.0) — Phase 13: Knowledge Base
-- Run after projects_foundation.sql (optional department/project/task
-- links). Attachments reuse the existing "task-attachments" Storage
-- bucket under a new metadata table - same reasoning as
-- meeting_attachments (meetings.sql): the bucket is just a namespace, and
-- task_attachments.task_id is NOT NULL and specific to tasks, so it can't
-- represent a knowledge article's files without changing what that table
-- means.

-- ============================================================
-- knowledge_articles
-- ============================================================
create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null default '',
  category text not null check (
    category in ('policy', 'procedure', 'form', 'guide', 'instruction', 'decision')
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  department_id uuid references public.departments(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  author_id uuid not null references public.users(id) on delete cascade,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'simple' config (no stemming dictionary) since stock Postgres has no
  -- Arabic-aware text search dictionary - still real indexed search, just
  -- literal-word matching rather than linguistic stemming
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) stored
);

create table public.knowledge_attachments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

create index knowledge_articles_organization_id_idx on public.knowledge_articles(organization_id);
create index knowledge_articles_category_idx on public.knowledge_articles(category);
create index knowledge_articles_status_idx on public.knowledge_articles(status);
create index knowledge_articles_search_idx on public.knowledge_articles using gin(search_vector);
create index knowledge_attachments_article_id_idx on public.knowledge_attachments(article_id);

create trigger knowledge_articles_set_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

-- stamps published_at once, the first time an article's status becomes
-- 'published' - re-publishing after an edit doesn't reset it
create function public.set_knowledge_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger knowledge_articles_set_published_at
  before update on public.knowledge_articles
  for each row execute function public.set_knowledge_published_at();

-- ============================================================
-- RLS - read/create/edit/publish/archive per the existing three-role
-- model, no new permission system. A draft is only visible to its author
-- and managers; published/archived articles are org-wide reading material.
-- ============================================================
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_attachments enable row level security;

create policy knowledge_articles_select on public.knowledge_articles
  for select using (
    organization_id = public.current_org_id() and (
      status != 'draft'
      or author_id = auth.uid()
      or public.current_user_role() in ('super_admin', 'department_manager')
    )
  );

create policy knowledge_articles_insert on public.knowledge_articles
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
    and author_id = auth.uid()
  );

-- covers edit/publish/archive alike - all three are just this table's own
-- status/content columns changing, by the same people (author or admin)
create policy knowledge_articles_update on public.knowledge_articles
  for update using (
    organization_id = public.current_org_id()
    and (public.current_user_role() = 'super_admin' or author_id = auth.uid())
  );

create policy knowledge_articles_delete on public.knowledge_articles
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

create policy knowledge_attachments_select on public.knowledge_attachments
  for select using (exists (select 1 from public.knowledge_articles a where a.id = article_id));

create policy knowledge_attachments_insert on public.knowledge_attachments
  for insert with check (
    exists (select 1 from public.knowledge_articles a where a.id = article_id) and uploaded_by = auth.uid()
  );

create policy knowledge_attachments_delete on public.knowledge_attachments
  for delete using (uploaded_by = auth.uid() or public.current_user_role() = 'super_admin');

-- ============================================================
-- search - SECURITY INVOKER, so RLS above still decides which articles a
-- given search can actually surface (a draft never leaks through search
-- results to someone who couldn't otherwise see it).
-- ============================================================
create or replace function public.search_knowledge_articles(p_query text)
returns table (
  id uuid,
  title text,
  category text,
  status text,
  updated_at timestamptz,
  rank real
)
language sql
security invoker
stable
as $$
  select a.id, a.title, a.category, a.status, a.updated_at,
    ts_rank(a.search_vector, websearch_to_tsquery('simple', p_query)) as rank
  from public.knowledge_articles a
  where a.search_vector @@ websearch_to_tsquery('simple', p_query)
  order by rank desc;
$$;
