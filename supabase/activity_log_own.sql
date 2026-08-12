-- MONJEZ V2 — "آخر أنشطتي" (my recent activity) feature.
-- activity_log_select (rls.sql) only ever let super_admin or a
-- department_manager (scoped to their own department's users) read this
-- table - a plain employee had no matching policy at all, so they could
-- not see even their OWN activity rows. Adds the missing "see your own
-- rows" policy, same shape as task_comments/notifications already use.
-- Multiple permissive policies for the same command are OR'd together in
-- Postgres, so this doesn't touch the existing admin/manager policy.

create policy activity_log_select_own on public.activity_log
  for select using (user_id = auth.uid());
