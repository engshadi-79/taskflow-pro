-- MONJEZ 3.0 P09 — AI Agent
-- Widens ai_suggested_actions.action_type to allow the new "create_task" suggestion type
-- introduced by the suggest_create_task tool in src/lib/ai/tools.ts.

alter table public.ai_suggested_actions drop constraint ai_suggested_actions_action_type_check;
alter table public.ai_suggested_actions
  add constraint ai_suggested_actions_action_type_check
  check (action_type in ('reassign_task', 'create_subtasks', 'create_task'));
