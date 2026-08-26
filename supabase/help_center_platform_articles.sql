-- Help Center — platform-wide feature articles (current + future orgs)
--
-- help_center_articles_seed.sql already established the pattern (one
-- knowledge_articles row per real feature, idempotent by title) but its own
-- comment admits the gap: it only ever targeted "the first organization" -
-- a brand new organization (self-signup via claim_new_organization) never
-- gets any of that content, and adding a new article for a new feature
-- meant hand-writing a fresh migration each time.
--
-- This adds a small durable catalog of "platform feature" article
-- templates, a function to copy them into one organization (idempotent,
-- same title-match guard as the existing seed file), a function to do that
-- for every organization at once, and one line in claim_new_organization so
-- every future organization gets the full catalog automatically at
-- creation. Existing knowledge_articles/RLS/UI are completely untouched -
-- this only adds a new source to copy FROM.

create table public.platform_help_article_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null check (
    category in ('policy', 'procedure', 'form', 'guide', 'instruction', 'decision')
  ),
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.platform_help_article_templates enable row level security;

-- Reference data, not org-scoped, nothing sensitive - same shape as
-- knowledge_categories_select in help_center.sql.
create policy platform_help_article_templates_select on public.platform_help_article_templates
  for select using (true);

-- Copies every template not already present (by title) into one
-- organization's knowledge_articles, published, authored by whichever
-- user is passed in. Safe to call repeatedly - already-copied titles are
-- skipped, exactly like help_center_articles_seed.sql's own guard.
create or replace function public.seed_platform_help_articles_for_org(p_org_id uuid, p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.knowledge_articles (organization_id, author_id, title, content, category, status, keywords, published_at)
  select p_org_id, p_author_id, t.title, t.content, t.category, 'published', t.keywords, now()
  from public.platform_help_article_templates t
  where not exists (
    select 1 from public.knowledge_articles a
    where a.organization_id = p_org_id and a.title = t.title
  );
end;
$$;

-- Runs the above for every organization, using each org's own earliest
-- super_admin as author - re-run this (one line) after adding a new
-- template row to backfill it into every organization that already
-- exists; claim_new_organization handles brand new ones on its own below.
create or replace function public.seed_platform_help_articles_for_all_orgs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
  admin_id uuid;
begin
  for org in select id from public.organizations loop
    select id into admin_id
    from public.users
    where organization_id = org.id and role = 'super_admin'
    order by created_at
    limit 1;

    if admin_id is not null then
      perform public.seed_platform_help_articles_for_org(org.id, admin_id);
    end if;
  end loop;
end;
$$;

-- One-time backfill for every organization that exists right now.
select public.seed_platform_help_articles_for_all_orgs();

-- From here on, every brand new organization gets the full catalog at the
-- moment it's created - caller_id is already promoted to super_admin of
-- new_org_id by the update right above this line.
create or replace function public.claim_new_organization(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  is_pending boolean;
  new_org_id uuid;
  clean_name text := trim(coalesce(p_org_name, ''));
begin
  if clean_name = '' then
    raise exception 'اسم المؤسسة مطلوب';
  end if;

  select (is_active = false) into is_pending
  from public.users
  where id = caller_id;

  if is_pending is not true then
    raise exception 'هذا الحساب غير مؤهَّل لإنشاء مؤسسة جديدة';
  end if;

  insert into public.organizations (name) values (clean_name)
  returning id into new_org_id;

  update public.users
  set organization_id = new_org_id,
      role = 'super_admin',
      is_active = true,
      department_id = null
  where id = caller_id;

  perform public.seed_platform_help_articles_for_org(new_org_id, caller_id);

  return new_org_id;
end;
$$;
