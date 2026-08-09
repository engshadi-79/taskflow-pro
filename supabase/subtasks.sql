-- TaskFlow Pro (MONJEZ 2.0) — Phase 04: subtasks
-- Run after projects_foundation.sql (needs tasks.project_id/milestone_id to
-- already exist for the inheritance logic below) and projects_foundation_fix.sql.
--
-- Subtasks reuse the existing tasks table via a self-referencing
-- parent_task_id, instead of a new table - a subtask has its own assignee,
-- status, due date, etc, exactly like Prompt 04's own tree example, and
-- tasks already has all of that. task_checklists (for the flat ☐/☑ list)
-- already exists from projects_foundation.sql - this file only adds the
-- subtask column/rules, nothing else.
alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_task_id_idx on public.tasks(parent_task_id);

-- Keeps the hierarchy exactly one level deep (a subtask can't itself have
-- subtasks - matches the plan's own tree, which is never more than two
-- rows tall) and keeps a subtask's project/milestone identical to its
-- parent's, always, regardless of what a client submits.
create function public.enforce_subtask_rules()
returns trigger
language plpgsql
as $$
declare
  parent_org uuid;
  parent_project uuid;
  parent_milestone uuid;
  parent_of_parent uuid;
begin
  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception 'لا يمكن أن تكون المهمة تابعة لنفسها';
    end if;

    select organization_id, project_id, milestone_id, parent_task_id
      into parent_org, parent_project, parent_milestone, parent_of_parent
    from public.tasks where id = new.parent_task_id;

    if parent_org is null then
      raise exception 'المهمة الرئيسية غير موجودة';
    end if;

    if parent_of_parent is not null then
      raise exception 'لا يمكن إضافة مهمة فرعية لمهمة فرعية أخرى';
    end if;

    if new.organization_id != parent_org then
      raise exception 'لا يمكن ربط مهام من مؤسسات مختلفة كمهمة فرعية';
    end if;

    -- inherited, never trusted from the client - a subtask can never drift
    -- onto a different project/milestone than its own parent
    new.project_id := parent_project;
    new.milestone_id := parent_milestone;
  end if;

  if exists (select 1 from public.tasks where parent_task_id = new.id) then
    raise exception 'لا يمكن جعل هذه المهمة تابعة لأخرى لأنها تحتوي بالفعل على مهام فرعية';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_subtask_rules
  before insert or update on public.tasks
  for each row execute function public.enforce_subtask_rules();
