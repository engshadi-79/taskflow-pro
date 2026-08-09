-- TaskFlow Pro (MONJEZ 2.0) — Phase 05: Task Dependencies enforcement
-- Run after projects_foundation.sql (task_dependencies table + the
-- self-reference/same-org checks already exist there). This file adds the
-- two things Phase 02 explicitly deferred to this phase: circular-dependency
-- detection, and blocking a status transition until dependencies clear.
--
-- Both are DB triggers, not just app-code checks - "لا تعتمد على JavaScript
-- في المتصفح لحماية المنطق" applies just as much to a Server Action as to
-- the browser: a trigger is the only layer a direct REST/RPC call against
-- this table can't bypass, matching how RLS is already this project's real
-- gate everywhere else.

-- ============================================================
-- circular dependency prevention
-- ============================================================
create function public.enforce_no_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  -- would adding task_id -> depends_on_task_id close a loop? true iff
  -- depends_on_task_id already (directly or transitively) depends on
  -- task_id - walk everything depends_on_task_id itself depends on and see
  -- if task_id shows up.
  if exists (
    with recursive chain(id) as (
      select new.depends_on_task_id
      union all
      select td.depends_on_task_id
      from public.task_dependencies td
      join chain c on td.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'هذا الربط يُنشئ دورة تبعية (Circular Dependency) بين المهام';
  end if;

  return new;
end;
$$;

create trigger task_dependencies_enforce_no_cycle
  before insert or update on public.task_dependencies
  for each row execute function public.enforce_no_dependency_cycle();

-- ============================================================
-- status-transition gate: a task can't reach a status its dependencies
-- don't yet allow. A dependency on a cancelled task is treated as already
-- satisfied - a cancelled task can never reach 'completed'/'in_progress',
-- so treating it as still-blocking would deadlock the dependent task
-- forever with no way out.
-- ============================================================
create function public.enforce_task_dependency_gate()
returns trigger
language plpgsql
as $$
declare
  blocker record;
begin
  if new.status is distinct from old.status then
    for blocker in
      select dt.status as dep_status, dt.title as dep_title, td.dependency_type
      from public.task_dependencies td
      join public.tasks dt on dt.id = td.depends_on_task_id
      where td.task_id = new.id
    loop
      if blocker.dep_status = 'cancelled' then
        continue;
      end if;

      if blocker.dependency_type = 'finish_to_start'
         and new.status in ('in_progress', 'pending_review', 'completed')
         and blocker.dep_status != 'completed' then
        raise exception 'لا يمكن بدء هذه المهمة قبل انتهاء المهمة "%"', blocker.dep_title;
      end if;

      if blocker.dependency_type = 'start_to_start'
         and new.status in ('in_progress', 'pending_review', 'completed')
         and blocker.dep_status = 'new' then
        raise exception 'لا يمكن بدء هذه المهمة قبل بدء المهمة "%"', blocker.dep_title;
      end if;

      if blocker.dependency_type = 'finish_to_finish'
         and new.status = 'completed'
         and blocker.dep_status != 'completed' then
        raise exception 'لا يمكن إنهاء هذه المهمة قبل انتهاء المهمة "%"', blocker.dep_title;
      end if;

      if blocker.dependency_type = 'start_to_finish'
         and new.status = 'completed'
         and blocker.dep_status = 'new' then
        raise exception 'لا يمكن إنهاء هذه المهمة قبل بدء المهمة "%"', blocker.dep_title;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_dependency_gate
  before update on public.tasks
  for each row execute function public.enforce_task_dependency_gate();
