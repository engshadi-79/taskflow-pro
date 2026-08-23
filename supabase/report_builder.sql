-- منشئ التقارير — يخزّن تعريفات تقارير مخصّصة (مصدر + حقول + فلاتر +
-- تجميع) فوق الجداول الموجودة، دون تعديل أي جدول أو سياسة سابقة.
-- الجدولة الدورية (إرسال تلقائي بالبريد) مؤجّلة عمدًا حتى يُحل قيد
-- Resend Sandbox الحالي - راجع src/lib/email/resend.ts.
--
-- الأمان: runReport() (src/lib/actions/report-builder.ts) ينفّذ الاستعلام
-- بجلسة المستخدم نفسه (وليس service role)، فتُطبَّق كل سياسات RLS
-- الموجودة تلقائيًا - موظف عادي لن يرى بيانات مؤسسة أخرى أو صفوفًا محجوبة
-- عنه أصلًا حتى لو بنى تقريرًا مخصّصًا. أسماء الأعمدة تُتحقَّق مقابل
-- allow-list صريح (report-fields-registry.ts) قبل الوصول لأي استعلام،
-- فلا يوجد تمرير مباشر لاسم عمود من المستخدم إلى SQL.

create table public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  source_entity text not null,
  selected_fields jsonb not null default '[]'::jsonb,
  filters jsonb not null default '[]'::jsonb,
  group_by text,
  aggregate jsonb,
  chart_type text not null default 'table' check (chart_type in ('table', 'bar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index report_definitions_organization_id_idx on public.report_definitions(organization_id);

alter table public.report_definitions enable row level security;

-- نفس شكل organization_holidays/plan_upgrade_requests: RLS بسيطة كافية
-- هنا، لا حاجة لدالة SECURITY DEFINER - "أنشئ/عدّل/احذف تعريفًا لمؤسستي"
-- ليس له بُعد يتجاوز المستخدم/المؤسسة الحاليين.
create policy report_definitions_select on public.report_definitions
  for select using (organization_id = public.current_org_id());

create policy report_definitions_insert on public.report_definitions
  for insert with check (
    organization_id = public.current_org_id() and created_by = auth.uid()
  );

create policy report_definitions_update on public.report_definitions
  for update using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'super_admin')
  );

create policy report_definitions_delete on public.report_definitions
  for delete using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'super_admin')
  );
