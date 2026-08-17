-- TaskFlow Pro (MONJEZ) — Help Center
--
-- Extends the existing knowledge_articles/knowledge_base.sql feature (does
-- NOT replace it) with what a browsable "help center" needs on top of plain
-- CRUD: a lookup table giving each category an icon/color/description,
-- per-user helpful/not-helpful voting with denormalized counts, a featured
-- flag, free-text keywords for search suggestions, and a view counter.
-- The existing /dashboard/knowledge admin CRUD pages, RLS, and hybrid
-- search (search_knowledge_articles / match_knowledge_articles) are
-- untouched and keep working exactly as before.

-- ============================================================
-- knowledge_categories - small reference table, not org-scoped (shared
-- metadata across every organization, same six ids the existing category
-- check constraint already allows).
-- ============================================================
create table public.knowledge_categories (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null,
  tone text not null default 'indigo' check (tone in ('red', 'indigo', 'green', 'blue', 'amber', 'violet', 'teal')),
  sort_order int not null default 0
);

insert into public.knowledge_categories (id, name, description, icon, tone, sort_order) values
  ('policy', 'سياسات', 'السياسات الرسمية للمؤسسة وقواعد العمل', 'lock', 'red', 1),
  ('procedure', 'إجراءات', 'خطوات تنفيذ العمليات والمهام اليومية', 'check-square', 'teal', 2),
  ('form', 'نماذج', 'النماذج والمستندات القابلة للتحميل', 'note', 'violet', 3),
  ('guide', 'أدلة', 'أدلة استخدام النظام خطوة بخطوة', 'book', 'indigo', 4),
  ('instruction', 'تعليمات', 'تعليمات وإرشادات سريعة للمهام الشائعة', 'info', 'blue', 5),
  ('decision', 'قرارات', 'القرارات والتعاميم الإدارية المعتمدة', 'check-circle', 'amber', 6)
on conflict (id) do nothing;

alter table public.knowledge_categories enable row level security;

create policy knowledge_categories_select on public.knowledge_categories
  for select using (true);

-- now that every existing category value has a matching row, tie the
-- column to it for referential integrity (the existing check constraint
-- stays - this is additive, not a replacement)
alter table public.knowledge_articles
  add constraint knowledge_articles_category_fkey foreign key (category) references public.knowledge_categories(id);

-- ============================================================
-- knowledge_articles - additive columns for the help-center browsing UX
-- ============================================================
alter table public.knowledge_articles
  add column if not exists keywords text[] not null default '{}',
  add column if not exists view_count integer not null default 0,
  add column if not exists is_featured boolean not null default false,
  add column if not exists helpful_count integer not null default 0,
  add column if not exists not_helpful_count integer not null default 0;

-- ============================================================
-- knowledge_article_votes - one helpful/not-helpful vote per user per
-- article; helpful_count/not_helpful_count on knowledge_articles are kept
-- in sync by the trigger below so list/search reads never need a join.
-- ============================================================
create table public.knowledge_article_votes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index knowledge_article_votes_article_id_idx on public.knowledge_article_votes(article_id);

alter table public.knowledge_article_votes enable row level security;

-- a user can only ever see/change their own vote row (needed client-side to
-- know "did I already vote and how") - aggregate counts are the
-- denormalized columns on knowledge_articles, visible to everyone through
-- the existing knowledge_articles_select policy
create policy knowledge_article_votes_select on public.knowledge_article_votes
  for select using (user_id = auth.uid());

create policy knowledge_article_votes_insert on public.knowledge_article_votes
  for insert with check (user_id = auth.uid());

create policy knowledge_article_votes_update on public.knowledge_article_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- security definer: a regular employee voting on someone else's published
-- article is not the article's author and isn't a manager, so the plain
-- knowledge_articles_update RLS policy would otherwise block this trigger's
-- own UPDATE of the denormalized counts.
create or replace function public.recalc_article_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.article_id, old.article_id);
  update public.knowledge_articles
  set
    helpful_count = (select count(*) from public.knowledge_article_votes where article_id = target_id and vote = 'up'),
    not_helpful_count = (select count(*) from public.knowledge_article_votes where article_id = target_id and vote = 'down')
  where id = target_id;
  return coalesce(new, old);
end;
$$;

create trigger knowledge_article_votes_recalc
  after insert or update or delete on public.knowledge_article_votes
  for each row execute function public.recalc_article_vote_counts();

-- ============================================================
-- increment_article_view - security definer for the same reason as the
-- vote trigger: viewing bumps a counter on a row the viewer usually can't
-- UPDATE themselves. Re-checks the exact visibility rule from
-- knowledge_articles_select so a view can't be recorded on an article the
-- caller couldn't otherwise see.
-- ============================================================
create or replace function public.increment_article_view(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.knowledge_articles
  set view_count = view_count + 1
  where id = p_article_id
    and organization_id = public.current_org_id()
    and (
      status != 'draft'
      or author_id = auth.uid()
      or public.current_user_role() in ('super_admin', 'department_manager')
    );
end;
$$;

-- ============================================================
-- search_knowledge_suggestions - lightweight ILIKE typeahead for the
-- hero search box (title/keywords only, no embedding call per keystroke).
-- The full search results page reuses the existing hybrid
-- searchKnowledgeArticles() helper instead. SECURITY INVOKER: RLS still
-- decides visibility, and only published articles are offered as
-- suggestions regardless of who's asking.
-- ============================================================
create or replace function public.search_knowledge_suggestions(p_query text, p_limit int default 6)
returns table (id uuid, title text, category text)
language sql
security invoker
stable
as $$
  select a.id, a.title, a.category
  from public.knowledge_articles a
  where a.status = 'published'
    and (
      a.title ilike '%' || p_query || '%'
      or exists (select 1 from unnest(a.keywords) kw where kw ilike '%' || p_query || '%')
    )
  order by a.view_count desc
  limit p_limit;
$$;
