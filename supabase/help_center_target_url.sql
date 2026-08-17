-- TaskFlow Pro (MONJEZ) — Help Center: "go to the actual page" link
--
-- Adds an optional target_url column so an article can point directly at
-- the real feature page it explains (e.g. "دليل استخدام المهام" ->
-- /dashboard/tasks), rendered as a prominent "الانتقال إلى الصفحة" button
-- on the article page. Nullable - articles without a mapped page simply
-- don't show the button.

alter table public.knowledge_articles
  add column if not exists target_url text;

-- populate the 27 articles seeded by help_center_articles_seed.sql with
-- their real page route. Safe to run more than once.
with target as (
  select (select id from public.organizations order by created_at limit 1) as org_id
),
seed(title, url) as (
  values
  ('لوحة التحكم', '/dashboard'),
  ('دليل استخدام المهام', '/dashboard/tasks'),
  ('استخدام لوحة كانبان', '/dashboard/kanban'),
  ('التنقل في التقويم وإعادة الجدولة', '/dashboard/calendar'),
  ('جدولة اجتماع ومتابعة محضره', '/dashboard/meetings'),
  ('بدء محادثة فردية أو مجموعة', '/dashboard/chat'),
  ('إنشاء مشروع وربط المهام به', '/dashboard/projects'),
  ('إضافة موظف جديد وإدارة حسابه', '/dashboard/employees'),
  ('إنشاء قسم وتعيين مديره', '/dashboard/departments'),
  ('إنشاء ونشر مقال في قاعدة المعرفة', '/dashboard/knowledge'),
  ('كيفية استخدام مركز المساعدة', '/dashboard/help'),
  ('قراءة التقارير وتصديرها', '/dashboard/reports'),
  ('فهم لوحة مركز القرار', '/dashboard/decisions'),
  ('قراءة تقرير الحمل الوظيفي', '/dashboard/workload'),
  ('تسجيل وتتبع وقت العمل', '/dashboard/time-tracking'),
  ('إعداد سياسات SLA', '/dashboard/sla-policies'),
  ('قراءة تقرير SLA', '/dashboard/sla-report'),
  ('تقديم طلب ومتابعته في مركز الطلبات', '/dashboard/workflow-requests'),
  ('الموافقة على الطلبات وتفويضها', '/dashboard/approvals'),
  ('كيف يعمل تقييم الأداء والمؤشرات', '/dashboard/performance'),
  ('تعريف أنواع الطلبات وخطوات موافقتها', '/dashboard/workflow-templates'),
  ('إنشاء قواعد الأتمتة', '/dashboard/automation-rules'),
  ('بناء سير عمل بصري في باني سير العمل', '/dashboard/workflow-builder'),
  ('إدارة الإشعارات وتفضيلاتها', '/dashboard/notifications'),
  ('إرسال تعميم أو إشعار إداري', '/dashboard/admin-notifications'),
  ('ضبط إعدادات المؤسسة', '/dashboard/settings'),
  ('تعديل الملف الشخصي', '/dashboard/profile')
)
update public.knowledge_articles a
set target_url = s.url
from target t, seed s
where a.organization_id = t.org_id
  and a.title = s.title
  and a.target_url is null;
