-- MONJEZ V2 — P07 fix: ambiguous "id" column reference (42702).
-- task_comments_with_authors()/task_mentionable_users() both RETURNS TABLE
-- with an `id` output column, which PL/pgSQL also exposes as an implicit
-- variable named `id` inside the function body - the department_manager
-- visibility check's "select id from public.users where department_id = ..."
-- was unqualified, so Postgres couldn't tell if `id` meant that OUT
-- parameter or users.id. Same fix as any other ambiguous-reference bug:
-- qualify every column reference with its table alias.

create or replace function public.task_comments_with_authors(p_task_id uuid)
returns table (
  id uuid,
  parent_comment_id uuid,
  user_id uuid,
  author_name text,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  is_edited boolean,
  mentioned_names text[],
  attachments jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.organization_id = public.current_org_id()
      and (
        public.current_user_role() = 'super_admin'
        or (public.current_user_role() = 'department_manager' and t.assigned_to in (
          select u.id from public.users u where u.department_id = public.current_department_id()
        ))
        or t.assigned_to = auth.uid()
      )
  ) then
    return;
  end if;

  return query
    select
      c.id,
      c.parent_comment_id,
      c.user_id,
      coalesce(u.full_name, 'مستخدم محذوف'),
      c.content,
      c.created_at,
      c.updated_at,
      c.updated_at > c.created_at,
      (
        select coalesce(array_agg(mu.full_name order by mu.full_name), array[]::text[])
        from public.task_comment_mentions m
        join public.users mu on mu.id = m.mentioned_user_id
        where m.comment_id = c.id
      ),
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'file_name', a.file_name, 'file_url', a.file_url, 'file_type', a.file_type
        ) order by a.uploaded_at), '[]'::jsonb)
        from public.task_comment_attachments a
        where a.comment_id = c.id
      )
    from public.task_comments c
    left join public.users u on u.id = c.user_id
    where c.task_id = p_task_id
    order by c.created_at asc;
end;
$$;

create or replace function public.task_mentionable_users(p_task_id uuid)
returns table (id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.organization_id = public.current_org_id()
      and (
        public.current_user_role() = 'super_admin'
        or (public.current_user_role() = 'department_manager' and t.assigned_to in (
          select u.id from public.users u where u.department_id = public.current_department_id()
        ))
        or t.assigned_to = auth.uid()
      )
  ) then
    return;
  end if;

  return query
    select distinct u.id, u.full_name
    from public.users u
    where u.id in (
      select t.assigned_to from public.tasks t where t.id = p_task_id
      union
      select t.created_by from public.tasks t where t.id = p_task_id
      union
      select c.user_id from public.task_comments c where c.task_id = p_task_id
    )
    and u.id != auth.uid()
    order by u.full_name;
end;
$$;
