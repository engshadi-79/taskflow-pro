-- TaskFlow Pro (MONJEZ 2.0) — Notify the organization on new knowledge articles
-- Run after knowledge_base.sql.
--
-- Fires on PUBLISH, not on raw creation - every new article starts as
-- 'draft' (knowledge_articles.status default), and knowledge_articles_select
-- hides drafts from everyone except the author and managers. Notifying the
-- whole org the moment a draft is created would hand most people a link
-- they can't actually open. Publishing is the point the content is
-- genuinely org-wide, so that's when everyone hears about it.
--
-- notifications gained a real article_id column - same reason meeting_id
-- was added for meetings (meeting_fixes.sql): a notification needs
-- something concrete to link back to and (if ever needed) dedupe against.
alter table public.notifications
  add column if not exists article_id uuid references public.knowledge_articles(id) on delete cascade;

create function public.notify_org_new_article()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (user_id, article_id, type, message)
    select u.id, new.id, 'knowledge_published', 'مقال جديد في قاعدة المعرفة: ' || new.title
    from public.users u
    where u.organization_id = new.organization_id
      and u.is_active
      and u.id != new.author_id;
  end if;
  return new;
end;
$$;

create trigger knowledge_articles_notify_published
  after update on public.knowledge_articles
  for each row execute function public.notify_org_new_article();
