-- MONJEZ V2 — P03: Advanced Task Workflow
-- Run after schema.sql, rls.sql, dashboard_extras.sql, automation_engine.sql.
--
-- Two gaps closed here:
--
-- 1. Status transitions were only validated in application code
--    (moveTaskStatus/submitForReview/reviewTask in src/lib/actions/tasks.ts).
--    tasks_update (rls.sql) only checks WHO may update a row, never WHICH
--    status values are reachable from which - a direct REST PATCH with an
--    assignee's own JWT could set their task straight to 'completed' or
--    'cancelled', skipping review entirely. This adds a BEFORE UPDATE
--    trigger enforcing the same transition rules the app already uses, at
--    the database layer, so an authorized-but-adversarial API call can't
--    bypass them (same class of gap already fixed for users.role in
--    fix_self_profile_update.sql).
--
--    super_admin/department_manager keep full freedom to set any status
--    (matches updateTask's existing edit-form behavior - unchanged). A
--    plain assignee may only move within {new, in_progress, pending_review}
--    and never out of completed/cancelled themselves - matches
--    DRAG_ALLOWED_FOR_ASSIGNEE + submitForReview's existing preconditions,
--    now enforced even outside the app.
--
--    Two legitimate system paths must stay exempt:
--    - pg_trigger_depth() > 1: an update firing from INSIDE another
--      trigger's execution (dispatch_task_automations -> execute_automation_action
--      changing status per an admin-configured automation rule) runs one
--      level deeper than a direct client statement - a raw client PATCH is
--      always depth 1 here, so this only exempts already-trusted
--      server-side chains, never a direct API call.
--    - auth.uid() is null: pg_cron jobs (mark_overdue_tasks,
--      run_sla_near_breach_automations) run with no request JWT at all.
--
-- 2. activity_log had no SELECT policy letting a plain employee see rows
--    for their OWN tasks (activity_log_select in rls.sql only covers
--    super_admin/department_manager) - a per-task Timeline would render
--    empty for the person it matters most to. Adds a policy scoped through
--    tasks_select (same "exists on the parent table" pattern already used
--    for meeting_attachments_select/knowledge_attachments_select), so
--    visibility follows whoever can already see the task.

create or replace function public.enforce_task_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;

  if public.current_user_role() in ('super_admin', 'department_manager') then
    return new;
  end if;

  -- a plain assignee: only within {new, in_progress, pending_review}, and
  -- never out of a resolved state (completed/cancelled) or out of
  -- pending_review themselves - only reviewTask (manager-gated) does that
  if old.status in ('new', 'in_progress')
     and new.status in ('new', 'in_progress', 'pending_review') then
    return new;
  end if;

  raise exception 'انتقال حالة غير مسموح به: % → %', old.status, new.status;
end;
$$;

drop trigger if exists tasks_enforce_status_transition on public.tasks;
create trigger tasks_enforce_status_transition
  before update on public.tasks
  for each row execute function public.enforce_task_status_transition();

create policy activity_log_select_task on public.activity_log
  for select using (
    entity_type = 'task' and exists (select 1 from public.tasks t where t.id = entity_id)
  );

-- Kanban's new postgres_changes subscription (src/components/dashboard/
-- kanban-board.tsx) needs tasks in the realtime publication - only
-- notifications was ever added (notifications_and_reports.sql). RLS still
-- applies to what each subscriber actually receives.
alter publication supabase_realtime add table public.tasks;
