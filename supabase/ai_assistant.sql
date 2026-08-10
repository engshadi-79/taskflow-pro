-- TaskFlow Pro (MONJEZ 2.0) — Phase 16: AI Assistant
-- Run after advanced_reports.sql. Two tables only:
--   ai_interactions        - one row per user message/reply pair, doubling
--                            as the audit log Prompt 16 requires and as the
--                            basis for rate limiting (count recent rows).
--   ai_suggested_actions   - a mutation the AI proposed but did NOT run.
--                            The AI layer (src/lib/ai/*) only ever inserts
--                            rows here with status='pending'; the actual
--                            table mutation happens later, in
--                            src/lib/actions/ai.ts, through the exact same
--                            permission checks (MANAGE_ROLES) that the
--                            existing task Server Actions already use - no
--                            new permission system, no direct AI writes.
--
-- No new "AI provider config" table: the provider/model/key live in
-- ANTHROPIC_API_KEY (server-only env var, same convention as
-- SUPABASE_SERVICE_ROLE_KEY) and src/lib/ai/assistant.ts, per Prompt 16's
-- own instruction to inspect the current stack before picking a provider.

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  prompt text not null,
  response text,
  tool_calls jsonb,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create table public.ai_suggested_actions (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.ai_interactions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  action_type text not null check (action_type in ('reassign_task', 'create_subtasks')),
  target_type text not null,
  target_id uuid not null,
  summary text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index ai_interactions_user_id_created_at_idx on public.ai_interactions(user_id, created_at desc);
create index ai_interactions_organization_id_idx on public.ai_interactions(organization_id);
create index ai_suggested_actions_created_by_idx on public.ai_suggested_actions(created_by);
create index ai_suggested_actions_interaction_id_idx on public.ai_suggested_actions(interaction_id);

alter table public.ai_interactions enable row level security;
alter table public.ai_suggested_actions enable row level security;

-- a user sees/logs only their own AI conversations; super_admin can audit
-- every interaction in their own organization (Prompt 16: "سجل كل AI action
-- في audit log" implies someone with authority can actually read it back)
create policy ai_interactions_select on public.ai_interactions
  for select using (
    user_id = auth.uid()
    or (organization_id = public.current_org_id() and public.current_user_role() = 'super_admin')
  );

create policy ai_interactions_insert on public.ai_interactions
  for insert with check (
    user_id = auth.uid() and organization_id = public.current_org_id()
  );

-- suggestions are only visible to and actionable by the person the AI made
-- them for - confirming/rejecting still re-checks the real permission for
-- the underlying mutation inside confirmAiAction/rejectAiAction, this just
-- controls who can see the suggestion card at all
create policy ai_suggested_actions_select on public.ai_suggested_actions
  for select using (
    created_by = auth.uid()
    or (organization_id = public.current_org_id() and public.current_user_role() = 'super_admin')
  );

create policy ai_suggested_actions_insert on public.ai_suggested_actions
  for insert with check (
    created_by = auth.uid() and organization_id = public.current_org_id()
  );

create policy ai_suggested_actions_update on public.ai_suggested_actions
  for update using (created_by = auth.uid());
