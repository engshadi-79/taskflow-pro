-- Help Center — platform-wide feature articles (current + future orgs)
--
-- help_center_articles_seed.sql already established the pattern (one
-- knowledge_articles row per real feature, idempotent by title) but its own
-- comment admits the gap: it only ever targeted "the first organization" -
-- a brand new organization (self-signup via claim_new_organization) never
-- gets any of that content, and adding a new article for a new feature
-- meant hand-writing a fresh migration each time.
--
-- This adds a small durable catalog of "platform feature" article
-- templates, a function to copy them into one organization (idempotent,
-- same title-match guard as the existing seed file), a function to do that
-- for every organization at once, and one line in claim_new_organization so
-- every future organization gets the full catalog automatically at
-- creation. Existing knowledge_articles/RLS/UI are completely untouched -
-- this only adds a new source to copy FROM.

create table public.platform_help_article_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null check (
    category in ('policy', 'procedure', 'form', 'guide', 'instruction', 'decision')
  ),
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.platform_help_article_templates enable row level security;

-- Reference data, not org-scoped, nothing sensitive - same shape as
-- knowledge_categories_select in help_center.sql.
create policy platform_help_article_templates_select on public.platform_help_article_templates
  for select using (true);

-- ============================================================
-- Populate the catalog. This is the piece the original version of this
-- file was missing entirely: the table/functions below existed, but
-- nothing ever inserted a single row into platform_help_article_templates,
-- so every copy call was a no-op and no organization (old or new) ever
-- actually received anything from this file.
-- ============================================================

-- 1) Carry over the 27 real articles already written in
--    help_center_articles_seed.sql, which only ever landed in the first
--    organization. Copied as-is (same title/content/category/keywords) -
--    not reworded, since that file's own content is already accurate to
--    the real implemented flows.
insert into public.platform_help_article_templates (title, content, category, keywords)
select ka.title, ka.content, ka.category, coalesce(ka.keywords, '{}')
from public.knowledge_articles ka
where ka.organization_id = (select id from public.organizations order by created_at limit 1)
  and not exists (
    select 1 from public.platform_help_article_templates t where t.title = ka.title
  );

-- 2) New articles for features shipped after that original seed file was
--    written, that no organization (including the first one) has ever
--    had an article for - verified against the real implemented UI
--    (field labels, button text, page locations) before writing, not
--    invented.
insert into public.platform_help_article_templates (title, content, category, keywords)
values

('المساعد الذكي (MONJEZ AI)', $art$نافذة "المساعد الذكي" (أيقونة النجمة العائمة في لوحة التحكم) تجيب على أسئلتك بالاعتماد على بيانات مؤسستك الفعلية (المهام، الأقسام، الحمل الوظيفي، الاجتماعات...)، ويمكنه أيضًا اقتراح إجراءات مثل إنشاء مهمة أو إرسال تذكير.

1) اضغط على أيقونة المساعد العائمة، أو زر "اسأل المساعد عن هذا" الظاهر بجانب بعض البطاقات في لوحة القرار.
2) اكتب سؤالك في الحقل أسفل النافذة واضغط إرسال.
3) إذا اقترح المساعد إجراءً (مثل إنشاء مهمة)، يظهر لك تفصيل الإجراء مع زر "تأكيد" و زر رفض — الإجراء لا يُنفَّذ أبدًا إلا بعد ضغطك "تأكيد" صراحة.

ℹ️ المساعد يجيب فقط من بيانات مؤسستك الخاصة (لا يرى بيانات مؤسسات أخرى)، ولا ينفّذ أي تعديل على البيانات من تلقاء نفسه.
⚠️ هذه الميزة تستهلك خدمة ذكاء اصطناعي خارجية (Gemini)؛ إذا لم تظهر عندك، فقد تكون معطّلة لمؤسستك من إدارة المنصة.$art$,
  'guide', array['المساعد الذكي','AI','اسأل المساعد','تأكيد إجراء','دردشة ذكية']::text[]),

('دعوة زميل إلى مؤسستك', $art$يتيح "المدير العام" إنشاء رابط دعوة يدخل من خلاله أي شخص إلى مؤسستك مباشرة وبحساب مفعّل فورًا، دون الحاجة لموافقة يدوية لاحقة.

1) من صفحة "الموظفون"، افتح قسم "روابط الدعوة".
2) اضغط "+ رابط دعوة جديد"، واختر "الدور" (موظف أو مدير قسم) و"القسم" (اختياري) و"الصلاحية (أيام)" و"عدد الاستخدامات" (اتركه فارغًا لدعوة غير محدودة الاستخدام).
3) اضغط "إنشاء الرابط"، ثم اضغط "نسخ الرابط" وأرسله للشخص المقصود (عبر أي وسيلة تواصل).
4) يفتح المدعوّ الرابط ويسجّل دخوله (عبر Google أو بريد/كلمة مرور) — يدخل تلقائيًا لمؤسستك بالدور والقسم المحددين، دون أي موافقة إضافية منك.

ℹ️ يمكنك رؤية عدد مرات الاستخدام مقابل الحد الأقصى لكل رابط، وإلغاءه في أي وقت بزر "إلغاء" — الروابط الملغاة تتوقف عن العمل فورًا.
⚠️ رابط الدعوة يعمل لأي شخص يحصل عليه قبل انتهاء صلاحيته أو استخدامه بالكامل؛ لا ترسله إلا لمن تثق به.$art$,
  'instruction', array['دعوة زميل','رابط دعوة','إضافة موظف','انضمام مباشر']::text[]),

('ربط منجز بـ Slack أو Microsoft Teams', $art$من "الإعدادات → إعدادات المطورين" يمكن للمدير العام ربط قناة Slack أو Teams لتصل إليها إشعارات فورية عند أحداث معينة (مهمة جديدة، تغيّر حالة مهمة، اكتمال مهمة) - دون الحاجة لأي إعداد برمجي.

1) في Slack: من إعدادات التطبيقات (Apps) أنشئ "Incoming Webhook" وانسخ رابطه. في Teams: من إعدادات القناة أنشئ اتصال Webhook (Connectors أو Workflows) وانسخ رابطه.
2) في "إعدادات المطورين"، اختر نوع الوجهة (Slack أو Teams) من القائمة، الصق الرابط، وحدّد الأحداث التي تريد إشعارًا عندها.
3) احفظ — أي حدث محدد بعدها يصل تلقائيًا كرسالة في القناة المرتبطة.

ℹ️ يمكنك أيضًا اختيار نوع "عام" لإرسال بيانات JSON موقّعة إلى أي نظام خارجي آخر تبنيه بنفسك.
⚠️ لا إعادة محاولة تلقائية إذا فشل التسليم؛ راجع سجل "محاولات التسليم" أسفل كل وجهة للتأكد من نجاحها.$art$,
  'instruction', array['Slack','Teams','ويب هوك','Webhook','تكامل','إشعارات خارجية']::text[]),

('مفاتيح API للمطورين', $art$يتيح "الإعدادات → إعدادات المطورين" للمدير العام إصدار مفاتيح API للسماح لأنظمة خارجية (مثل ERP) بالوصول إلى بيانات المؤسسة برمجيًا.

1) في قسم "مفاتيح API"، اكتب اسمًا وصفيًا للمفتاح (مثال: "تكامل ERP") واضغط "إنشاء مفتاح".
2) انسخ المفتاح فورًا من الرسالة الظاهرة — لن يظهر النص الكامل للمفتاح مرة أخرى بعد إغلاق الرسالة.
3) استخدم المفتاح في ترويسة الطلب: `Authorization: Bearer <المفتاح>` عند الاتصال بواجهة API الخاصة بمنجز.

ℹ️ يمكنك إلغاء أي مفتاح في أي وقت؛ الإلغاء فوري ولا يمكن التراجع عنه.
⚠️ عامل كل مفتاح مثل كلمة مرور - أي شخص يملكه يستطيع الوصول لبيانات مؤسستك ضمن صلاحياته.$art$,
  'instruction', array['API','مفتاح API','تكامل خارجي','مطورين']::text[]),

('تحويل ملف Excel حسب قالب', $art$أداة "تحويل ملف حسب قالب" (ضمن صفحة التقارير) تأخذ ملف بيانات خام (Excel) وتنتج ملفًا مطابقًا لشكل قالب جاهز (Excel أو Word) تحدده أنت، دون الحاجة لنسخ ولصق يدوي.

1) ارفع "ملف القالب" (Excel أو Word يحدد شكل الأعمدة/التنسيق النهائي) — يمكنك حفظه لاستخدامه لاحقًا دون رفعه من جديد.
2) ارفع ملف البيانات الخام الذي يحتوي الصفوف الفعلية.
3) اربط كل عمود في القالب بالعمود المقابل له في ملف البيانات (يقترح النظام الربط تلقائيًا عند تطابق الأسماء، ويمكنك تعديله يدويًا).
4) إذا كان ناتج التحويل بنفس صيغة القالب (Excel إلى Excel، أو Word إلى Word) يحافظ الملف الناتج على تنسيق القالب وترويسته بالكامل؛ إذا اختلفت الصيغة، يُنشأ جدول بسيط بدون تنسيق القالب الأصلي.
5) اضغط توليد الملف وحمّله.

ℹ️ يمكنك تجميع الصفوف حسب عمود معيّن من ملف البيانات (مثل القسم أو الفرع) بحيث يتكرر رأس القالب لكل مجموعة في نفس الملف الناتج.$art$,
  'guide', array['تحويل Excel','قالب','منشئ التقارير','ربط الأعمدة']::text[]),

('ترقية الخطة والدفع', $art$تُعرض بيانات الخطة الحالية والترقية إلى الخطة المدفوعة من "الإعدادات → الخطة والفوترة".

1) اختر طريقة الدفع المتاحة (تحويل بنكي أو Binance) واطّلع على تفاصيل الحساب المعروضة.
2) حوّل المبلغ المتفق عليه مع فريق الدعم عبر الطريقة المختارة.
3) أدخل "رقم/مرجع التحويل" في الحقل المخصص، وأضف ملاحظة إن أردت، ثم أرسل الطلب.
4) بعد مراجعة الفريق للتحويل، تُفعَّل الخطة المدفوعة تلقائيًا على مؤسستك (تظهر فورًا في نفس الصفحة).

ℹ️ الخطة المجانية محدودة بعدد مقاعد وفترة تجريبية؛ الخطة المدفوعة بلا حد للمقاعد وبلا فترة تجريبية.
⚠️ تفعيل الخطة يتم يدويًا بعد التحقق من التحويل، وليس فوريًا لحظة الإرسال.$art$,
  'procedure', array['ترقية الخطة','الفوترة','تحويل بنكي','Binance','خطة مدفوعة']::text[]);

-- Copies every template not already present (by title) into one
-- organization's knowledge_articles, published, authored by whichever
-- user is passed in. Safe to call repeatedly - already-copied titles are
-- skipped, exactly like help_center_articles_seed.sql's own guard.
create or replace function public.seed_platform_help_articles_for_org(p_org_id uuid, p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.knowledge_articles (organization_id, author_id, title, content, category, status, keywords, published_at)
  select p_org_id, p_author_id, t.title, t.content, t.category, 'published', t.keywords, now()
  from public.platform_help_article_templates t
  where not exists (
    select 1 from public.knowledge_articles a
    where a.organization_id = p_org_id and a.title = t.title
  );
end;
$$;

-- Runs the above for every organization, using each org's own earliest
-- super_admin as author - re-run this (one line) after adding a new
-- template row to backfill it into every organization that already
-- exists; claim_new_organization handles brand new ones on its own below.
create or replace function public.seed_platform_help_articles_for_all_orgs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
  admin_id uuid;
begin
  for org in select id from public.organizations loop
    select id into admin_id
    from public.users
    where organization_id = org.id and role = 'super_admin'
    order by created_at
    limit 1;

    if admin_id is not null then
      perform public.seed_platform_help_articles_for_org(org.id, admin_id);
    end if;
  end loop;
end;
$$;

-- One-time backfill for every organization that exists right now.
select public.seed_platform_help_articles_for_all_orgs();

-- From here on, every brand new organization gets the full catalog at the
-- moment it's created - caller_id is already promoted to super_admin of
-- new_org_id by the update right above this line.
create or replace function public.claim_new_organization(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  is_pending boolean;
  new_org_id uuid;
  clean_name text := trim(coalesce(p_org_name, ''));
begin
  if clean_name = '' then
    raise exception 'اسم المؤسسة مطلوب';
  end if;

  select (is_active = false) into is_pending
  from public.users
  where id = caller_id;

  if is_pending is not true then
    raise exception 'هذا الحساب غير مؤهَّل لإنشاء مؤسسة جديدة';
  end if;

  insert into public.organizations (name) values (clean_name)
  returning id into new_org_id;

  update public.users
  set organization_id = new_org_id,
      role = 'super_admin',
      is_active = true,
      department_id = null
  where id = caller_id;

  perform public.seed_platform_help_articles_for_org(new_org_id, caller_id);

  return new_org_id;
end;
$$;
