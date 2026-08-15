-- MONJEZ 3.0 P10 — AI Knowledge Center: semantic (vector) search
-- Extends the existing keyword-only knowledge_base.sql (search_knowledge_articles,
-- tsvector) with a real embeddings pipeline. Does not touch or replace the
-- tsvector column/function — the two are merged in application code via
-- reciprocal rank fusion (src/lib/knowledge/search.ts), not superseded.

create extension if not exists vector;

alter table public.knowledge_articles
  add column if not exists embedding vector(768);

-- HNSW: unlike ivfflat it needs no upfront training/list-count tuning, which
-- fits a table that starts near-empty and grows slowly.
create index if not exists knowledge_articles_embedding_idx
  on public.knowledge_articles
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_knowledge_articles(p_embedding vector(768), p_match_count int default 20)
returns table (id uuid, title text, category text, status text, updated_at timestamptz, similarity real)
language sql
security invoker -- RLS still applies, same as search_knowledge_articles()
stable
as $$
  select a.id, a.title, a.category, a.status, a.updated_at,
    (1 - (a.embedding <=> p_embedding))::real as similarity
  from public.knowledge_articles a
  where a.embedding is not null
  order by a.embedding <=> p_embedding
  limit greatest(p_match_count, 1);
$$;
