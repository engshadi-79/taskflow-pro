-- TaskFlow Pro (MONJEZ 2.0) — fix for projects_foundation.sql
-- Run once, right after projects_foundation.sql.
--
-- projects_select referenced project_members directly, and
-- project_members_select/project_members_write reference projects directly -
-- two tables whose RLS policies query each other, which Postgres evaluates
-- under the querying role each time (a policy's USING clause has no
-- SECURITY DEFINER concept of its own), so the two policies re-triggered
-- each other endlessly ("infinite recursion detected in policy for relation
-- projects"). Exactly the trap current_user_role()/current_org_id() in
-- rls.sql already exist to avoid for public.users - missed applying the
-- same fix here for the new projects<->project_members pair.
--
-- Fix: one SECURITY DEFINER function that checks membership by reading
-- project_members directly, bypassing its RLS entirely (it runs as the
-- function owner, same as the existing current_*() helpers) - so
-- projects_select no longer triggers project_members' own policies at all,
-- which breaks the cycle for every table below it too.
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_role() = 'department_manager' and department_id = public.current_department_id())
      or public.is_project_member(id)
    )
  );
