-- MONJEZ 3.0 — Feature Flags
-- Per-organization on/off switches for four real modules, for two real
-- reasons: controlling the cost of an external API call (Gemini, behind
-- the AI assistant), and being able to hand a module to specific
-- organizations before flipping it on for everyone. Mirrors the P02
-- permission-matrix shape (a catalogue + a narrower override table)
-- instead of a single jsonb column.

create table public.feature_flags (
  key text primary key,
  label text not null,
  description text not null,
  default_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.organization_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

alter table public.feature_flags enable row level security;
alter table public.organization_feature_overrides enable row level security;

-- Catalogue is readable by any authenticated user (needed to resolve their
-- own org's enabled features at layout/page level); only ever written via
-- the platform owner's service-role client - no insert/update/delete
-- policy, same "no policy = only service-role touches it" shape already
-- used for webhook_deliveries.
create policy feature_flags_select on public.feature_flags for select using (true);

create policy organization_feature_overrides_select on public.organization_feature_overrides
  for select using (organization_id = public.current_org_id());

insert into public.feature_flags (key, label, description, default_enabled) values
  ('ai_assistant', 'المساعد الذكي', 'الشات الذكي المرتبط ببيانات المؤسسة - يستهلك واجهة Gemini الخارجية', true),
  ('automation_rules', 'الأتمتة', 'قواعد الأتمتة والقوالب الجاهزة', true),
  ('report_builder', 'منشئ التقارير ومحول Excel', 'إنشاء تقارير مخصصة وتحويل ملفات Excel حسب قالب', true),
  ('developer_api', 'واجهة API والـ Webhooks', 'مفاتيح API ووجهات Webhook (عام/Slack/Teams)', true);
