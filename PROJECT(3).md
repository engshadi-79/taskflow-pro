# PROJECT(3).md — الحالة الفعلية الحالية (خط الأساس لخطة MONJEZ 3.0)

هذا الملف **ليس خطة**، بل تصوير دقيق لما هو موجود فعليًا في الكود اليوم،
قبل البدء بأي مرحلة من `MONJEZ_3_0_CLAUDE_CODE_PROMPTS_v2.md` (P01–P20).
بُني من فحص شامل للكود الفعلي (جداول SQL، سياسات RLS، Server Actions،
صفحات الواجهة) لا من الذاكرة أو الافتراض. الهدف: معرفة ما يجب إعادة
استخدامه/توسيعه (Audit → Reuse → Extend) قبل كتابة أي كود جديد لكل مرحلة،
تفاديًا لإعادة بناء ما يعمل أصلًا.

يوثّق `PROJECT.md` (بدون رقم) تاريخ وقرارات MONJEZ 2.0 و"V2" (P01–P11)
السابقة — يبقى كما هو كسجل تاريخي. هذا الملف الجديد هو المرجع الحي لحالة
"3.0" فقط، ويُحدَّث بعد كل مرحلة تُنجَز منها.

---

## ملخص الحالة مقابل كل مرحلة

| # | المرحلة | الحالة | الفجوة الأساسية |
|---|---|---|---|
| P01 | Foundation & Architecture 3.0 | ✅ مكتمل (انظر تفصيل أدناه) | Feature Flags أُجِّل عمدًا لعدم وجود حاجة فعلية بعد |
| P02 | Security & RBAC | ✅ مكتمل (انظر تفصيل أدناه) | صلاحية `notifications.send_org_wide` قابلة للتفعيل لمدير قسم من المصفوفة شكليًا، لكن الفحص الصارم داخل SQL لم يُهاجَر بعد (تفصيل أدناه) |
| P03 | Employee Workspace | ✅ مكتمل (انظر تفصيل أدناه) | لا تزال ضمن نفس `page.tsx` لا مسار مستقل — قرار نطاق واعٍ، لا نقص |
| P04 | Manager Workspace | ✅ مكتمل (انظر تفصيل أدناه) | لا تزال ضمن نفس `page.tsx` — قرار نطاق واعٍ، لا نقص |
| P05 | Request Center | 🟢 موجود (كمحرك عام) | لا مرفقات ولا SLA على الطلب، ولا حقول مخصّصة لكل نوع طلب |
| P06 | Workflow Builder | ❌ غير موجود بصريًا | المحرك (خطوات/شروط/إجراءات) موجود وفعّال، لكن التهيئة عبر نماذج لا Canvas مرئي |
| P07 | Approval Center | ❌ غير موجود | لا صندوق وارد موافقات مستقل ولا Bulk Approval ولا تفويض؛ آلية السلسلة نفسها موجودة في المحرك |
| P08 | KPI & Performance | 🟡 جزئي | مقاييس فردية غنية (إنجاز/التزام/SLA/حمل) لكن لا Score مركّب موزون |
| P09 | AI Agent | 🟢 موجود | 17 أداة قراءة + أداتا اقتراح إجراء مع تأكيد بشري إلزامي وسجل تدقيق كامل |
| P10 | AI Knowledge Center | 🟡 جزئي | بحث نصي (tsvector) فعّال، لا بحث دلالي (Embeddings/pgvector) |
| P11 | Automation Center | 🟢 موجود | محرك Trigger→Condition→Action فعّال بسجل تنفيذ؛ ينقصه معرض قوالب و Retry تلقائي |
| P12 | Notification Center | 🟡 جزئي | بنية تحتية قوية (جرس + بث إداري + جدولة/تكرار)، صفر تفضيلات شخصية (قنوات/DND/ملخص) |
| P13 | Executive Decision Center | ❌ غير موجود | تقارير ورسوم بيانية غنية، لا طبقة "ماذا حدث/لماذا/ما الإجراء" |
| P14 | Global Search | 🟡 جزئي | Command Palette حقيقي عبر Ctrl+K موجود، يغطي مهام/موظفين/أقسام فقط |
| P15 | Email & Scheduled Reports | ❌ غير موجود (البريد) | صفر تكامل بريد إلكتروني؛ 8 مهام cron موجودة لكن كلها داخل النظام فقط |
| P16 | SaaS Multi-Tenant | 🟡 جزئي | البنية متعددة المؤسسات فعليًا (RLS)، لكن التسجيل الذاتي لا ينشئ مؤسسة جديدة عمليًا |
| P17 | Plans & Billing | ❌ غير موجود | `plan_type` عمود غير مستخدم إطلاقًا في أي منطق |
| P18 | API & Webhooks | ❌ غير موجود | مسارا API فقط (`ai/chat`, `reports/export`)، لا مفاتيح API ولا Webhooks |
| P19 | Enterprise Integrations | ❌ غير موجود | فقط تسجيل الدخول عبر Google، لا مزامنة تقويم/بريد/ملفات |
| P20 | Mobile | 🟡 جزئي | PWA حقيقي (Shell Caching متعمد وضيق)، لا دعم Offline للمهام ولا Capacitor |

---

## P01 — Foundation & Architecture 3.0 (مكتمل)

بُنيت 6 خدمات مشتركة تحت `src/lib/foundation/` تخدم كل الدومينات المذكورة
في الخطة (لا خدمة واحدة لكل دومين)، مع تفعيلها فعليًا في ملفين حقيقيين
(`admin-notifications.ts` بالكامل، و`organization-settings.ts` جزئيًا) لا
كملفات غير مُستخدَمة، ثم تُوسَّع لبقية الدومينات تدريجيًا مع كل مرحلة لاحقة
تلمسها (لا هجرة شاملة لكل الكود دفعة واحدة — قرار نطاق واعٍ لا نقص).

- **Domain Events** — [src/lib/foundation/events.ts](src/lib/foundation/events.ts):
  ناقل أحداث داخل العملية فقط (`on`/`emit`)، لا يُكرّر أو يستبدل آلية
  الفصل الموجودة أصلًا عبر SQL Triggers + pg_cron (محرك الأتمتة، كشف خرق
  SLA) — تلك تبقى كما هي. يُصدر حاليًا حدثين حقيقيين
  (`admin_notification.sent`, `organization_settings.updated`) من نقطتي
  اتصال فعليتين. **لا مشترك مسجَّل بعد** — هذا متوقَّع ومقصود: البنية
  التحتية جاهزة للمراحل القادمة (P07 الموافقات، P12 تفضيلات الإشعارات،
  P18 الـ Webhooks) لتشترك فيها لاحقًا دون أن يعرف الكود الذي يُصدر
  الحدث اليوم أي شيء عن ذلك المستهلك المستقبلي.
- **Centralized Error Handling** — [src/lib/foundation/errors.ts](src/lib/foundation/errors.ts):
  تسلسل `AppError`/`ValidationError`/`PermissionError`/`NotFoundError`/
  `RateLimitError` + `toActionError()` تحوّل أي استثناء لشكل `{ error }`
  الموحّد الذي ترجعه كل Server Action أصلًا.
- **Validation Layer موحّدة** — [src/lib/foundation/validation.ts](src/lib/foundation/validation.ts)
  (Zod، تم تثبيته حديثًا): `parseFormData(schema, formData, arrayFields)`
  تحوّل FormData لكائن مُتحقَّق منه بنداء واحد، بديلًا عن سلاسل
  `if (!x) return { error }` اليدوية المتكررة.
- **Permission Service مركزي** — [src/lib/foundation/permissions.ts](src/lib/foundation/permissions.ts):
  واجهة تسمية للقدرات (`can.manageOrganization`, `can.sendAdminNotification`,
  `can.sendAdminNotificationOrgWide`, ...) فوق نموذج الأدوار الثلاثة
  الحالي — عندما تُبنى P02 الحقيقية (صلاحيات دقيقة/مجموعات/Scope)، تُستبدل
  أجساد هذه الدوال فقط، دون أن تتغير أي نقطة استدعاء.
- **Audit Service مركزي** — [src/lib/foundation/audit.ts](src/lib/foundation/audit.ts):
  `logActivity()` تكتب في جدول `activity_log` **الموجود أصلًا** (عام منذ
  `schema.sql`، لكنه لم يكن يُكتب إليه إلا من Trigger واحد لنشاط المهام)
  — الآن أي Server Action لأي دومين يمكنها تسجيل حدث تدقيق مباشرة، وقد
  تحقّقتُ أن سياسة `activity_log_insert` الحالية (`organization_id =
  current_org_id() and user_id = auth.uid()`) تسمح بذلك دون أي تعديل RLS.
- **Idempotency** — [src/lib/foundation/idempotency.ts](src/lib/foundation/idempotency.ts)
  + جدول جديد `idempotency_keys` ([supabase/foundation_3_0.sql](supabase/foundation_3_0.sql)):
  `claimIdempotencyKey()` تمنع تكرار تنفيذ عملية حسّاسة عند إرسال مزدوج
  (نقرتين على "تأكيد الإرسال"). مُفعّلة على إرسال الإشعار الإداري الفوري
  (مفتاح فريد لكل تحميل للنموذج، مُمرَّر كحقل مخفي).
- **Rate Limiting** — [src/lib/foundation/rate-limit.ts](src/lib/foundation/rate-limit.ts)
  + جدول جديد `rate_limit_hits` (نفس الملف): `enforceRateLimit()` تعميم
  للنمط الذي استخدمه `/api/ai/chat` يدويًا ضد `ai_interactions` سابقًا،
  الآن جدول عام واحد لأي عملية حسّاسة. مُفعّل على الإرسال الفوري (10
  إشعارات/5 دقائق لكل مستخدم) — **قيد جديد لم يكن موجودًا من قبل**، يستحق
  الانتباه إن احتاج مدير قسم لإرسال أكثر من ذلك فعليًا.
- **Feature Flags** — **أُجِّل عمدًا**، لا حاجة فعلية واضحة الآن (تطبيقًا
  لقاعدة "لا يُنفَّذ إلا عند حاجة واضحة"). يُبنى عند أول طلب فعلي له.

**ملفات SQL جديدة:** [supabase/foundation_3_0.sql](supabase/foundation_3_0.sql)
(`idempotency_keys`, `rate_limit_hits`، مع مهمتي تنظيف cron كل ساعة لكل
منهما لمنع نمو غير محدود).

**الاختبارات المنطقية المُجراة** (بدون جلسة متصفح فعلية، عبر مراجعة الكود
والتحقق من سياسات RLS المطابقة):
- موظف عادي يستدعي `sendAdminNotification` → `can.sendAdminNotification`
  ترجع false → `PermissionError` → نفس رسالة الخطأ السابقة تمامًا.
- department_manager يحاول `target_type=all` → `can.sendAdminNotificationOrgWide`
  ترجع false → مرفوض على مستوى JS **و** على مستوى دالة SQL
  `send_admin_notification()` المُستقلّة أصلًا (دفاع مزدوج لم يُمسّ).
  إرسال مزدوج بنفس `idempotency_key` → المحاولة الثانية تفشل بـ
  `unique_violation` → تُعامَل كنجاح صامت (توجيه للقائمة دون تكرار البث).
- تجاوز 10 إرسالات/5 دقائق → `RateLimitError` برسالة عربية واضحة.
- `tsc --noEmit` / `eslint` / `next build` كلها نظيفة، والمسارات كلها
  ديناميكية كما كانت.

---

## P02 — Security & RBAC (مكتمل)

طبقة صلاحيات دقيقة **فوق** RLS الحالي (132 سياسة، لم تُمَس)، لا بديلًا عنه،
ولا استبدالًا لنموذج الأدوار الثلاثة نفسه (`users.role` بقي كما هو —
استبداله بجدول أدوار ديناميكي كان سيلمس كل سياسة RLS في قاعدة البيانات
دفعة واحدة، وهو بالضبط "إعادة بناء ما يعمل دون سبب معماري واضح" الممنوعة).

- **الجداول** (`supabase/security_rbac.sql`): `permissions` (كتالوج عام
  15 صلاحية مجمّعة في 10 فئات)، `role_permissions` (المصفوفة الفعلية،
  **لكل مؤسسة** — `organization_id, role, permission_key, scope` — وليست
  عامة، لأن هذا نظام متعدد المؤسسات فعليًا؛ اكتُشفت هذه الفجوة أثناء تنفيذ
  المرحلة نفسها وصُححت قبل الدفع، انظر أدناه)، `user_permission_overrides`
  (منح/سحب استثنائي لموظف بعينه). دالة `get_user_permissions(p_user_id)` هي
  مصدر الحقيقة الوحيد (افتراضي الدور ناقص المسحوب زائد الممنوح)، **وتستثني
  المستخدم غير النشط صراحةً** — أحد اختبارات الأمان الإلزامية لهذه المرحلة.
- **مصفوفة قابلة للتعديل دون كود**: `getCurrentProfile()` يجلب الآن
  `permissionKeys` الفعلية مع كل طلب، و`src/lib/foundation/permissions.ts`
  (من P01) لم تتغيّر توقيعاته إطلاقًا — فقط الجسم الداخلي لكل `can.x()`
  أصبح يفحص `permissionKeys` بدل مقارنة دور ثابتة، تمامًا كما وُعِد في
  توثيق P01. **نتيجة عملية:** ترقية تلقائية بلا لمس كود لكل من
  `admin-notifications.ts` و`organization-settings.ts` (من P01)، بالإضافة
  لتوسيع حقيقي جديد إلى: `sla-policies` (صفحة + إجراءات)،
  `automation-rules` (صفحة + إجراءات)، `workflow-templates` (صفحة +
  إجراءات) — 5 مناطق فعلية الآن مدفوعة بالمصفوفة، لا مجرد واجهة تجريبية.
- **واجهة الإدارة**: `/dashboard/settings/permissions` (رابط من صفحة
  إعدادات المؤسسة) — جدول صلاحيات × أدوار قابل للنقر، عمود "مدير عام" ثابت
  غير قابل للتعديل **عمدًا**: تعديل هذا المسار عبر دالة `toggle_role_permission()`
  محمي بفحص دور صريح (`current_user_role() = 'super_admin'`) لا بصلاحية
  من المصفوفة نفسها — لمنع سيناريو يقفل فيه Super Admin نفسه خارج الصفحة
  الوحيدة القادرة على إصلاح الخطأ.
- **ثغرة عزل بين المؤسسات اكتُشفت وأُصلحت أثناء هذه المرحلة (قبل الدفع)**:
  التصميم الأول جعل `role_permissions` عامة (بلا `organization_id`) وترك
  سياسات `user_permission_overrides` تتحقق من الدور فقط دون التأكد أن
  المستخدم المستهدف من نفس مؤسسة المستدعي — كان يعني عمليًا أن Super Admin
  في مؤسسة يمكنه نظريًا التأثير على صلاحيات مؤسسة أخرى بالكامل. صُحح قبل
  إنشاء أي Commit: `role_permissions` الآن لكل مؤسسة مع Trigger يزرع القيم
  الافتراضية تلقائيًا لأي مؤسسة جديدة تُنشأ لاحقًا (تسجيل Google الذاتي)،
  وسياسات `user_permission_overrides` تتحقق من مؤسسة المستخدم المستهدف
  فعليًا.
- **قيد معروف غير مُهاجَر بعد**: صلاحية `notifications.send_org_wide` قابلة
  للتفعيل لمدير قسم من المصفوفة شكليًا، لكن `_resolve_admin_notification_recipients()`
  (في `admin_notifications_phase2.sql`، تُستخدم من 3 مسارات: إرسال فوري/
  مجدول/متكرر) لا تزال تطبّق فحصها الصلب الأصلي (مدير القسم ممنوع من
  استهداف "الجميع" دائمًا) بشكل مستقل تمامًا عن المصفوفة الجديدة. أي
  تفعيل لهذه الصلاحية من الواجهة **لن يُغيّر السلوك الفعلي** حتى تُهاجَر
  تلك الدالة لاحقًا لتستشير `get_user_permissions()` بدل الفحص الثابت —
  تأجيل متعمّد لتفادي لمس دالة حساسة تعمل بشكل صحيح لثلاثة مسارات دفعة
  واحدة في نفس المرحلة التي أضافت المصفوفة.

**الاختبارات الأمنية الخمسة الإلزامية لهذه المرحلة** (تحقّق منطقي عبر مراجعة
الكود وسياسات RLS، بلا جلسة متصفح فعلية):
1. موظف يغيّر role/department_id — غير متأثر؛ لا تزال محمية بدوال
   `update_own_profile`/`update_own_avatar` (SECURITY DEFINER بقائمة أعمدة
   بيضاء) من إصلاح V2 السابق؛ الجداول الجديدة كلها مقيّدة بـsuper_admin
   للكتابة فلا تفتح مسارًا جديدًا للتصعيد.
2. وصول لمؤسسة أخرى — كانت هذه بالضبط الثغرة المذكورة أعلاه، أُصلحت قبل
   الدفع.
3. مدير يعدّل موظف قسم آخر أو يرسل إشعارًا خارج نطاقه — محمي بفحص RLS
   القسمي الحالي + قيد `_resolve_admin_notification_recipients()` الثابت
   (غير المُهاجَر، انظر أعلاه) كطبقة دفاع إضافية لم تُمس.
4. inactive user على API — `get_user_permissions()` تتحقق من `u.is_active`
   صراحةً، فيعود مصفوفة فارغة بغض النظر عن الدور.
5. وصول لسجل خارج النطاق عبر REST مباشر — RLS نفسه (132 سياسة) هو خط
   الدفاع هنا ولم يتغيّر؛ الجداول الجديدة أُضيفت بنفس نمط التقييد.

`tsc --noEmit` / `eslint` / `next build` نظيفة، والمسار الجديد
`/dashboard/settings/permissions` مسجَّل في جدول التوجيه.

---

## P03 — Employee Workspace (مكتمل)

لوحة الموظف كانت غنية بالفعل (عدّادات المهام، الحمل الوظيفي، الأداء،
الملاحظات، مهامي العاجلة، قائمة المهام) — الفجوة الحقيقية الوحيدة مقابل
محتوى الخطة كانت "طلباتي" و"اجتماعاتي"، فأُضيفا كودجتين مصغّرتين
(`MiniListPanel` المُعاد استخدامه من لوحة المدير، لا مكوّن جديد):

- **طلباتي**: آخر 5 طلبات قدّمها الموظف (`workflow_requests` حيث
  `requested_by = profile.id`)، مع اسم نوع الطلب من `workflow_templates`
  وحالته (`WORKFLOW_STATUS_LABEL` المُعاد استخدامه من نوع موجود أصلًا)،
  رابط لكل الطلبات في `/dashboard/workflow-requests`.
- **اجتماعاتي**: الاجتماعات القادمة (غير الملغاة) التي الموظف طرف فيها،
  عبر جدول `meeting_attendees` (`user_id = profile.id`) مع Join لجدول
  `meetings` لاسم/تاريخ/وقت الاجتماع، الأقرب أولًا.

كلا الودجتين يُضافان لنفس `Promise.all` الموجود أصلًا في الفرع الخاص
بالموظف داخل `src/app/dashboard/page.tsx` — لا عميل Supabase جديد ولا
استعلامات منفصلة عن نمط الصفحة الحالي.

**"لا أدوات إدارية لا يحتاجها الموظف":** محقَّق ببنية الكود نفسها — فرع
الموظف (`profile.role === "employee"`) منفصل بالكامل عن فرع المدير/الإداري
منذ البداية، ولا يستورد أو يعرض أي مكوّن إداري. `QuickShortcuts` مُقيَّد
بالدور أصلًا عبر `resolveShortcuts()`. لم يُحتَج لأي تعديل هنا.

**Avatar/Quick Shortcuts/Notifications/Recent Activity/Dark-Light/Responsive:**
كلها موجودة فعلًا وتعمل لكل الأدوار بلا استثناء — الصورة الشخصية في لافتة
الترحيب، الاختصارات السريعة، الجرس وزر "آخر أنشطتي" في الشريط العلوي
المشترك (`Topbar`، يُصيَّر في `dashboard/layout.tsx` بصرف النظر عن الدور)،
مبدّل الوضع الداكن/الفاتح (`ThemeToggle` في نفس الشريط)، والتخطيط متجاوب
عبر فئات Tailwind (`grid-cols-1 sm:grid-cols-2` وما شابه) المستخدمة في كل
مكان. لم تكن هناك حاجة لأي عمل إضافي هنا — تحقّق فقط، لا بناء.

`tsc --noEmit` / `eslint` / `next build` نظيفة. لا SQL جديد لهذه المرحلة
(استعلامات على جداول موجودة أصلًا فقط).

---

## P04 — Manager Workspace (مكتمل)

لوحة المدير/الإداري كانت غنية بالفعل (بطاقة أسبوعية، KPIs، توزيع حسب
القسم/الأولوية، اتجاه أسبوعي، حمل وظيفي، التزام SLA، مشاريع حديثة، أفضل
أداء، نشاط أخير، فلاتر فترة/قسم/مشروع/موظف) — الفجوات الحقيقية مقابل
محتوى الخطة كانت: تفصيل حالة المهام، طلبات الموافقة، المشاريع المتعثرة،
وفلترا الحالة/الأولوية. أُضيفت كلها لنفس `Promise.all` الموجود في فرع
المدير/الإداري داخل `page.tsx`، لا استعلامات منفصلة:

- **تفصيل حالة المهام**: كانت "المهام النشطة/قيد المراجعة/المتأخرة"
  مجمَّعة في رقم واحد (`pendingCount`) بلا تفكيك. أُضيف صف بطاقات جديد:
  نشطة (`new`+`in_progress`)، بانتظار المراجعة (`pending_review`)، متأخرة
  (`overdue`) — وكلها **قيم حالة حقيقية** في العمود (`overdue` تُحدَّثها
  مهمة `mark_overdue_tasks()` الدورية أصلًا، ليست محسوبة من `due_date` عند
  القراءة).
- **طلبات تحتاج موافقة**: بطاقة عدّاد + قائمة مصغّرة، بالاعتماد على سياسة
  `workflow_requests_select` RLS الموجودة أصلًا بدل إعادة تنفيذ منطق
  `can_act_on_workflow_request()` في JS — استعلام `status='pending' and
  requested_by != profile.id` يُرجع تلقائيًا فقط "طلباتي المرسلة" مطروحًا
  منها، أي "الطلبات التي أستطيع فعليًا التصرف فيها" بفضل RLS نفسه.
- **مشاريع متعثرة**: تعريف صريح غير مُصطنَع — مشروع `status='active'`
  تجاوز `due_date` فعلًا، لا نتيجة درجة مخاطرة وهمية.
- **فلترا الحالة والأولوية**: أُضيفا لشريط الفلاتر وإلى `withDashboardFilters()`
  المشتركة، بنفس نمط فلاتر الموظف/المشروع الموجودة أصلًا — يتركّبان بشكل
  حقيقي (AND) مع أي استعلام مُقيَّد بحالة ثابتة أصلًا (كـ`completedCount`)،
  فقد يُصفِّر بعض البطاقات عند اختيار حالة متعارضة، وهو سلوك متوقَّع لا
  عطل (تمامًا كما يفعل فلترا موظف+مشروع غير متوافقين اليوم).

**خطأ اكتُشف وأُصلح أثناء التنفيذ (قبل أي Commit):** إدراج استعلامين
جديدين في `Promise.all` دون تحديث مواضعهما المقابلة في قائمة
Destructuring بنفس الترتيب تسبّب في ربط `departmentsForFilter`/
`projectsForFilter`/`employeesForFilter` ببيانات خاطئة تمامًا (خطأ صامت
كان سيمرّ لولا أن TypeScript رصد تعارض الأنواع). صُحح الترتيب بالكامل
وأُعيد التحقق يدويًا من تطابق كل عنصر في القائمتين (33 عنصرًا) قبل الدفع.

`tsc --noEmit` / `eslint` / `next build` نظيفة. لا SQL جديد (استعلامات
على جداول موجودة أصلًا فقط).

---

## 1. نموذج الصلاحيات (P02)

- الدور مسطّح فقط: `Role = "super_admin" | "department_manager" | "employee"`
  ([src/lib/types/roles.ts](src/lib/types/roles.ts)). لا جدول/نظام صلاحيات
  دقيقة (permission strings) أو مجموعات صلاحيات في أي مكان.
- دوال RLS مركزية تُستخدم في 132 سياسة عبر كل الجداول: `current_user_role()`،
  `current_org_id()`، `current_department_id()` ([supabase/rls.sql](supabase/rls.sql))
  — `current_org_id()` أُعيد تعريفها لاحقًا لتشترط `is_active` أيضًا
  ([supabase/google_signup.sql](supabase/google_signup.sql)).
- فحوصات دور مباشرة متكررة (`profile.role !== "..."`) في عشرات الملفات
  (`admin-notifications.ts`, `workflow.ts`, `sla.ts`, `automation.ts`...)
  بلا تجريد مشترك، عدا `requireRole()` في
  [src/lib/actions/guards.ts](src/lib/actions/guards.ts) المخصص فقط
  للإجراءات التي تستخدم عميل service-role.
- لا مفهوم Scope (organization/department/team/self) مستقل عن السياسة
  المكتوبة يدويًا في كل جدول.

**الخلاصة:** RLS كخط دفاع أساسي ناضج وموجود بالفعل ويُستخدم في كل مكان —
هذا يجب أن يبقى كما هو (القاعدة الثابتة تمنع استبدال RLS). ما ينقص P02 هو
طبقة Permission Service **فوق** RLS، لا بديلًا عنه.

## 2/3. لوحة الموظف ولوحة المدير (P03/P04)

`src/app/dashboard/page.tsx` (666 سطرًا) يتفرّع كليًا حسب
`profile.role === "employee"`:

- **الموظف:** عدّادات (إجمالي/مستحقة اليوم/قادمة 7 أيام/متأخرة)، نسبة الحمل
  الوظيفي (`employee_workload`)، إحصاءات شخصية (`report_employee_stats`)،
  ودجت الملاحظات، ملخص المهام العاجلة، قائمة المهام الكاملة.
- **المدير/الإدارة:** بطاقة أسبوعية + KPIs (مهام جديدة، إشعارات غير مقروءة،
  أعضاء نشطون، نسبة إنجاز)، توزيع حسب القسم/الأولوية، اتجاه أسبوعي، لوحة
  حمل العمل، مؤشر التزام SLA، قائمة مشاريع مصغّرة، أفضل الأداء، تغذية نشاط،
  وشريط فلاتر (فترة/قسم [لـ super_admin فقط]/مشروع/موظف).

**الخلاصة:** لوحتان غنيتان بالبيانات فعليًا وليستا بطاقات فارغة — العمل هنا
تنظيم/فصل لا بناء من الصفر، وربما فصل كل دور لمسار مستقل إن أراد ذلك P03/P04.

## 3. مركز الطلبات (P05)

- محرك عام واحد لا جداول منفصلة لكل نوع طلب: `workflow_requests` +
  `workflow_templates` + `workflow_steps` + `workflow_actions`
  ([supabase/workflow_engine.sql](supabase/workflow_engine.sql), 319 سطرًا).
  "نوع الطلب" = صف في `workflow_templates`، لا جدول مستقل.
- دورة الحياة: `status` ∈ `pending/approved/rejected/cancelled`،
  `current_step_position`، `is_escalated`، إعادة تعيين المسار عبر
  `current_step_override_user_id`. كل إجراء يُسجَّل في `workflow_actions`
  (`submit/approve/reject/return/escalate/reassign/cancel`).
- المُوافِقون يُحلّون عبر `approver_type` ∈
  `department_manager/super_admin/specific_user`
  (`can_act_on_workflow_request()`).
- **لا** عمود مرفقات، **لا** SLA/تاريخ استحقاق على الطلب نفسه، **لا** حقول
  مخصّصة لكل نوع (كل شيء `title`+`details` نصي عام).
- الواجهة: [src/app/dashboard/workflow-requests/page.tsx](src/app/dashboard/workflow-requests/page.tsx)
  (جدول مسطّح) + `[id]/page.tsx` للتفاصيل/الإجراء.

**الخلاصة:** سلسلة موافقات متعددة الخطوات + تصعيد/إعادة تعيين تعمل فعليًا
من طرف لطرف. الناقص: مرفقات، SLA على الطلب، حقول مخصّصة لكل نوع.

## 4. باني سير العمل (P06)

- `workflow_templates`/`workflow_steps` تُهيَّأ عبر نموذج نصي بسيط
  ([src/app/dashboard/workflow-templates/page.tsx](src/app/dashboard/workflow-templates/page.tsx))
  — قائمة خطوات مرتّبة (`position`, `approver_type`, `specific_user_id`
  اختياري)، **لا Canvas/Node-Graph مرئي إطلاقًا**.
- محرك منفصل تمامًا للأتمتة:
  [supabase/automation_engine.sql](supabase/automation_engine.sql) (314 سطرًا)
  — `trigger_event` ∈ `task_created/task_status_changed/task_overdue/
  sla_near_breach/project_completed`، شروط JSON مسطّحة (مساواة فقط، لا
  منطق مركّب)، 9 أنواع إجراءات ثابتة (`notify_*`, `change_status`,
  `change_priority`, `create_followup_task`, `reassign`).
  سجل تنفيذ عبر `automation_executions` (منع تكرار عبر
  `unique(rule_id, entity_id)`).

**الخلاصة:** المحرّكان (سير العمل + الأتمتة) فعّالان ومُستخدَمان، لكن كلاهما
بلا أي واجهة بصرية (Drag & Drop Canvas) — هذا بالكامل عمل جديد في P06، فوق
محرك خلفي جاهز لا يُعاد بناؤه.

## 5. مركز الموافقات (P07)

- لا صندوق وارد موافقات مستقل — الموافقة تتم من صفحة تفاصيل الطلب نفسها.
  صفحة القائمة تعرض كل الطلبات (الخاصة بي + القابلة لإجرائي + الكل إن كنت
  إداريًا) في جدول واحد، لا فلتر "بانتظار موافقتي" مخصّص.
- لا Bulk Approval، لا تفويض مسبق (Delegation) — يوجد فقط تصعيد/إعادة تعيين
  بعد الإرسال. السلاسل متعددة الخطوات (`workflow_steps.position`) مدعومة
  فعليًا في المحرك.

**الخلاصة:** آليات الموافقة (تعدد خطوات، تصعيد، إعادة تعيين) موجودة في
الخلفية بالكامل؛ الناقص هو واجهة صندوق وارد مخصّصة + إجراء جماعي — عمل
واجهة بالكامل تقريبًا فوق خلفية جاهزة.

## 6. الأداء والمؤشرات (P08)

- `report_employee_stats()`: عدد المكتمل، نسبة الالتزام بالوقت، متوسط ساعات
  الإنجاز ([supabase/report_employee_stats.sql](supabase/report_employee_stats.sql)).
- `sla_report()`: نسبة الالتزام، عدد الخروقات ([supabase/sla_engine.sql](supabase/sla_engine.sql)).
- `employee_workload()`: حمل مرجّح بالأولوية → نسبة → حالة
  منخفض/عادي/مرتفع/حرج ([supabase/workload.sql](supabase/workload.sql)).
- تقارير إضافية: أداء القسم/الموظف/المشروع/الأولوية، المتأخر حسب القسم
  ([supabase/advanced_reports.sql](supabase/advanced_reports.sql))، سلاسل
  زمنية يومية، متوسط الساعات حسب القسم
  ([supabase/reports_extended.sql](supabase/reports_extended.sql))، نسبة
  رفض المراجعة ([supabase/review_rejection_rate.sql](supabase/review_rejection_rate.sql)).
- **لا وجود إطلاقًا** لأي Score مركّب موزون (لا "جودة" ولا "تقييم مدير" في
  أي مكان).

**الخلاصة:** مقاييس فردية غنية وجاهزة لإعادة الاستخدام كمدخلات؛ الناقص هو
حساب Score مركّب موزون بالكامل — بُعد جديد بالكامل.

## 7. وكيل الذكاء الاصطناعي (P09)

- `ai_interactions` (سجل تدقيق كامل: prompt/response/tool_calls/tokens) +
  `ai_suggested_actions` (`status`: `pending/confirmed/rejected`)
  ([supabase/ai_assistant.sql](supabase/ai_assistant.sql)).
- 17 أداة قراءة فقط تعمل ضمن صلاحيات المستخدم عبر RLS (أداء الأقسام/
  الموظفين/المشاريع/الأولويات، المتأخر، الحمل الوظيفي، SLA، المهام
  الحرجة، ملخصات موظف/مشروع/اجتماع، بحث المعرفة، قوائم الأقسام/المشاريع/
  الموظفين) — [src/lib/ai/tools.ts](src/lib/ai/tools.ts).
- أداتا اقتراح فعل فقط (`suggest_reassign_task`, `suggest_create_subtasks`)
  — الذكاء الاصطناعي **لا يكتب مباشرة أبدًا**؛ التنفيذ الفعلي فقط بعد تأكيد
  بشري عبر `confirmAiAction`/`rejectAiAction`
  ([src/lib/actions/ai.ts](src/lib/actions/ai.ts))، بإعادة فحص الدور
  (`MANAGE_ROLES`) قبل التنفيذ.
- المسار: [src/app/api/ai/chat/route.ts](src/app/api/ai/chat/route.ts)؛
  المزوّد الفعلي Google Gemini، لا Anthropic.

**الخلاصة:** نموذج "اقتراح → تأكيد بشري → تنفيذ → تدقيق" مطبَّق بالكامل
ويطابق تمامًا قاعدة P09 الأمنية الثابتة. الفجوة فقط في اتساع مجموعة الأدوات
لا في المعمارية.

## 8. مركز المعرفة الذكي (P10)

- `knowledge_articles` (تصنيف: سياسة/إجراء/نموذج/دليل/تعليمة/قرار، حالة:
  مسودة/منشور/مؤرشف) + `knowledge_attachments`
  ([supabase/knowledge_base.sql](supabase/knowledge_base.sql)).
- البحث عمود `tsvector` مولَّد (`to_tsvector('simple', ...)`) +
  `search_knowledge_articles()` عبر `websearch_to_tsquery`/`ts_rank` — بحث
  نصي كلاسيكي، **لا عمود Embedding/Vector إطلاقًا**، ولا قاموس عربي مخصّص
  (يستخدم `'simple'` صراحة).

**الخلاصة:** CRUD + دورة نشر كاملة + بحث نصي فعّال موجود؛ البحث الدلالي
(pgvector + خط أنابيب تضمين) غائب تمامًا — يحتاج امتدادًا جديدًا لا إعادة
بناء.

## 9. مركز الأتمتة (P11)

- `automation_rules` (حدث/شروط JSON/نوع إجراء/معاملات/فعّال) +
  `automation_executions` (سجل تدقيق ومنع تكرار)
  ([supabase/automation_engine.sql](supabase/automation_engine.sql)).
- التفعيل عبر Triggers مباشرة على `tasks`/`projects`
  (`dispatch_task_automations`, `dispatch_project_automations`) + مهمة
  cron كل 15 دقيقة لحالة `sla_near_breach`
  (`run_sla_near_breach_automations`).
- لا إعادة محاولة تلقائية (Retry) عند الفشل — الخطأ يُسجَّل فقط.
- الواجهة: [automation-rules/page.tsx](src/app/dashboard/automation-rules/page.tsx)
  (super_admin فقط)، تعرض القواعد + آخر 500 تنفيذ.

**الخلاصة:** مركز أتمتة فعّال فعليًا بمنطق Trigger→Condition→Action وسجل
تنفيذ حقيقي. الناقص: معرض قوالب جاهزة + Retry تلقائي.

## 10. مركز الإشعارات (P12)

- الأساس: جدول `notifications` بسيط (`user_id, task_id, type, message,
  is_read`) + `NotificationBell` عبر Supabase Realtime.
- الإشعارات الإدارية (ميزة كاملة أُنجزت هذه الجلسة، خارج ترقيم V2):
  [supabase/admin_notifications.sql](supabase/admin_notifications.sql) +
  [supabase/admin_notifications_phase2.sql](supabase/admin_notifications_phase2.sql)
  (589 سطرًا): جدولة، تكرار دوري (`admin_notification_series`)، قوالب،
  مهمتا cron (`process-scheduled-admin-notifications` كل 5 دقائق،
  `process-recurring-admin-notification-series` كل 15 دقيقة).
- **لا يوجد إطلاقًا** نظام تفضيلات شخصي: لا اختيار قناة (In-App/Browser/
  Email) لكل نوع، لا Quiet Hours، لا DND، لا ملخص يومي/أسبوعي — تأكَّد
  بالفحص الكامل، صفر نتائج.

**الخلاصة:** بنية تحتية للإشعارات قوية وحقيقية (جرس + بث إداري + جدولة/
تكرار + 8 مهام cron منتجة للإشعارات عبر النظام كله)؛ طبقة "تفضيلات لكل
مستخدم" غائبة بالكامل — هذا تحديدًا محتوى P12 الجديد.

## 11. مركز القرار التنفيذي (P13)

- [src/app/dashboard/reports/page.tsx](src/app/dashboard/reports/page.tsx)
  (599 سطرًا): رسوم بيانية ومؤشرات فقط (أداء قسم/موظف/مشروع، توزيع
  الأولوية، المتأخر حسب القسم، سلسلة يومية، متوسط ساعات حسب القسم، توزيع
  الحالة، نسبة رفض المراجعة).
- لا طبقة سردية "ماذا حدث/لماذا/أين المشكلة/ما الإجراء المقترح" في أي مكان.

**الخلاصة:** طبقة BI/رسوم بيانية غنية موجودة فعلًا تصلح كمصدر بيانات؛ طبقة
القرار/التوصية بالكامل جديدة.

## 12. البحث الموحّد (P14)

- [src/components/dashboard/command-palette.tsx](src/components/dashboard/command-palette.tsx):
  لوحة أوامر حقيقية عبر Ctrl+K تبحث في آنٍ واحد في المهام (العنوان)،
  المستخدمين (الاسم/المسمى الوظيفي)، الأقسام (الاسم)، بالإضافة للتنقل بين
  الصفحات الثابتة، مع بادئات نطاق (`t:`/`e:`/`d:`/`p:`)، وسجل عمليات بحث/
  عناصر أخيرة (localStorage)، وتنقّل بلوحة المفاتيح.
- **لا يغطي** المستندات/مقالات المعرفة، الاجتماعات، أو المشاريع.

**الخلاصة:** تجربة بحث موحّد حقيقية (لا مجرد صناديق بحث منفصلة لكل صفحة)
موجودة فعلًا؛ الفجوة في اتساع الكيانات المغطاة فقط.

## 13. البريد والتقارير المجدولة (P15)

- **صفر** تكامل بريد إلكتروني صادر في أي مكان (تحقّق شامل: لا Resend، لا
  SendGrid، لا SMTP، لا Nodemailer، لا Mailgun).
- 8 مهام cron موجودة فعليًا، كلها داخل النظام فقط (لا خطوة بريد ضمن أيٍّ
  منها): بث الإشعارات الإدارية المجدولة/الدورية، تصعيد قرب خرق SLA، تذكير
  الاجتماعات، تذكير تاريخ الاستحقاق، تحديد المهام المتأخرة، توليد المهام
  المتكررة، خرق SLA.
- [src/app/api/reports/export/route.ts](src/app/api/reports/export/route.ts)
  موجود للتصدير عند الطلب فقط، لا جدولة ولا إرسال بريد.

**الخلاصة:** بنية cron ناضجة (8 مهام تعمل فعليًا) يمكن البناء عليها لتوليد
تقارير مجدولة؛ خطوة "البريد الإلكتروني" غائبة بالكامل وتحتاج مزوّد بريد من
الصفر.

## 14. SaaS متعدد المؤسسات (P16)

- البنية متعددة المؤسسات فعليًا: `organization_id` في كل جدول رئيسي و132
  سياسة RLS مبنية عليه.
- التسجيل الذاتي عبر Google **لا** ينشئ مؤسسة جديدة لكل مسجّل — ينضم
  المسجّل الجديد لأقدم مؤسسة مسجّلة ويبقى `is_active = false` حتى يوافق
  super_admin؛ إنشاء مؤسسة جديدة فعليًا يحدث فقط في حالة واحدة (صفر
  مؤسسات مسجّلة إطلاقًا) — وهي حالة نظرية، فالنظام يُستخدم فعليًا من مؤسسة
  واحدة فقط حتى الآن رغم أن المخطط يدعم التعدد بنيويًا.
- إعدادات/هوية المؤسسة: [supabase/organization_settings.sql](supabase/organization_settings.sql)
  (شعار، منطقة زمنية، أيام/ساعات عمل، عطل رسمية، قيم افتراضية للمهام/SLA).
- **لا** تتبع استخدام (Usage Tracking)، **لا** Feature Flags في أي مكان.

**الخلاصة:** الأساس البنيوي (عزل عبر RLS + إعدادات مؤسسة) قوي وموجود؛
الإنشاء الذاتي الحقيقي متعدد المؤسسات + تتبع الاستخدام + Feature Flags كلها
عمل جديد.

## 15. الخطط والفوترة (P17)

- `organizations.plan_type` عمود موجود (`'free'|'paid'`) لكنه **غير
  مُستخدَم إطلاقًا** في أي منطق تحقّق أو تقييد — يُضبط فقط عند الإدراج.
- لا تكامل فوترة (Stripe أو غيره) في أي مكان.

**الخلاصة:** عمود فارغ الأثر فقط — P17 بالكامل عمل جديد.

## 16. الـ API والـ Webhooks (P18)

- مساران فقط: `/api/ai/chat`، `/api/reports/export`.
- لا جدول مفاتيح API، لا Webhooks، لا أي سطح API عام.

**الخلاصة:** عمل جديد بالكامل.

## 17. التكاملات المؤسسية (P19)

- التكامل الوحيد هو تسجيل الدخول عبر Google (هوية فقط، لا مزامنة تقويم/
  بريد/ملفات).
- لا تكامل Microsoft/Slack/Teams في أي مكان.

**الخلاصة:** عمل جديد بالكامل (ويُفضَّل تأجيله لما بعد استقرار API، كما
تنص الخطة نفسها).

## 18. الجوال (P20)

- PWA حقيقي: `public/manifest.json` + `public/sw.js` +
  `service-worker-register.tsx`. الكاش يقتصر عمدًا على أصول Next الثابتة
  وأيقونات PWA فقط — أي تنقّل بين الصفحات أو استدعاء `/api/*`/Server Action
  يذهب للشبكة دائمًا (بيانات كل مستخدم محكومة بـ RLS، لا يجوز تخزينها
  محليًا أو تقديمها Offline، بحسب تعليق صريح في الكود).
- لا قائمة انتظار Offline لأي تعديل، لا إعداد Capacitor في أي مكان.

**الخلاصة:** غلاف PWA قابل للتثبيت موجود؛ دعم Offline الحقيقي للمهام وأي
غلاف Native (Capacitor) كلاهما عمل جديد بالكامل.

---

## التالي

عند قول المستخدم "اكمل": **P05 — Request Center**، حسب البروتوكول في
`MONJEZ_3_0_CLAUDE_CODE_PROMPTS_v2.md` (Audit → Reuse → Extend، مرحلة
واحدة فقط، توقف كامل بعدها بانتظار أمر صريح للتالية).
