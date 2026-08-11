# MONJEZ V2 — P01 Audit & Foundation

تاريخ الفحص: 2026-08-11
النطاق: فحص فقط، بلا أي تعديل على الكود (حسب قاعدة P01).

---

## ملخص تنفيذي

- **مشكلة حرجة واحدة (Critical)**: سياسة RLS لتحديث `users` تسمح لأي مستخدم بتعديل `role`/`department_id`/`organization_id`/`is_active` **في صف نفسه** عبر استدعاء REST مباشر (خارج واجهة الموقع)، رغم أن الواجهة والـ Server Action لا يسمحان بذلك ظاهريًا. هذا تصعيد صلاحيات حقيقي وقابل للاستغلال الآن.
- باقي فحوصات الصلاحيات (Auth، IDOR، عزل المؤسسات، إساءة استخدام Service Role، تسريب بيانات عبر API) **نظيفة** — لم يُعثر على أي ثغرة أخرى.
- عدة عناصر من خطة V2 موجودة بالفعل جزئيًا من عمل المرحلة السابقة (Recurring metadata فقط بلا تنفيذ فعلي، Calendar بلا Drag & Drop، Comments بدون Threads/Mentions، Attachments بدون Versioning/Preview، Notification Center بدون تصفية/حذف/تفضيلات).
- عناصر غير موجودة إطلاقًا: Organization Settings، Web Push، أي مفهوم Billing/Plans حقيقي، Platform Admin Console.
- لا توجد صفحات `loading.tsx`/`error.tsx`/`not-found.tsx` على مستوى المسارات إطلاقًا.
- تباين ألوان `text-faint` أقل من معيار WCAG AA في كلا الوضعين (فاتح وداكن).

---

## 1. الأمان والصلاحيات (Security & RLS)

### 1.1 Auth — نظيف
جميع صفحات `src/app/dashboard/**/page.tsx` (28 صفحة) تستدعي `getCurrentProfile()` وتُعيد التوجيه إلى `/login` عند عدم وجود جلسة. لا توجد صفحة تتجاوز هذا الفحص.

### 1.2 تصعيد الصلاحيات عبر تعديل الملف الشخصي — **حرج (Critical)**
- `src/lib/actions/users.ts` (`updateOwnProfile`, `uploadAvatar`) تُحدّث فقط `full_name`/`phone`/`secondary_email`/`bio`/`avatar_url` — لا تسمح بتعديل `role`/`department_id`/`organization_id`.
- **لكن**: `supabase/self_profile_update.sql` يضيف سياسة `users_self_update`:
  ```sql
  create policy users_self_update on public.users
    for update
    using (id = auth.uid())
    with check (id = auth.uid());
  ```
  هذه السياسة **لا تقيّد الأعمدة القابلة للتعديل إطلاقًا** — فقط تقيّد "أي صف". أي طلب `PATCH /rest/v1/users?id=eq.<own-id>` بجسم `{"role": "super_admin"}` باستخدام JWT المستخدم نفسه سينجح تحت هذه السياسة وحدها، متجاوزًا القائمة البيضاء للحقول الموجودة فقط في الـ Server Action.
- **التأثير**: أي موظف عادي (`employee`) يمكنه ترقية نفسه إلى `super_admin`، أو تغيير `department_id`/`organization_id` الخاص به، بطلب REST واحد فقط، دون المرور بواجهة الموقع إطلاقًا.
- ملاحظة: التعليق داخل الملف نفسه يوثّق هذه الفجوة صراحة منذ إنشائه — كانت معروفة نظريًا لكن لم تُغلق.

### 1.3 IDOR على المسارات الديناميكية — نظيف
تم فحص `tasks/[id]`, `projects/[id]`, `meetings/[id]`, `profile/[id]`, `knowledge/[id]`: جميعها تستخدم `createClient()` (عميل مقيّد بـRLS)، ولا يستورد أي منها `admin.ts` أو `SUPABASE_SERVICE_ROLE_KEY`.

### 1.4 عزل المؤسسات (Cross-Organization) — نظيف
`report_department_performance`, `report_priority_performance` تعتمدان على RLS الجداول الأساسية (`tasks_select`, `departments_select` كلاهما يُقيَّد بـ`organization_id = current_org_id()`). `meeting_detail_extra` (رغم كونها `SECURITY DEFINER`) تتحقق صراحة من `organization_id = current_org_id()` قبل إرجاع أي بيانات.

### 1.5 إساءة استخدام Service Role — نظيف
الاستخدام الوحيد لـ`SUPABASE_SERVICE_ROLE_KEY` في `src/lib/actions/users.ts` (`createEmployee`, `deleteEmployee`) — كلاهما يستدعي `requireRole(["super_admin"])` **قبل** إنشاء عميل الإدارة (`createAdminClient()`)، فلا يوجد مسار يصل للمفتاح دون تحقق دور مسبق.

### 1.6 تسريب بيانات عبر API — نظيف
`/api/reports/export` يمنع `employee` (403) ويستخدم عميلاً مقيّدًا بـRLS فقط. `/api/ai/chat` يتطلب جلسة مصادَق عليها ولا يستخدم عميل إدارة في أي مكان بامتداد `src/lib/ai/`.

---

## 2. الوصولية (Accessibility)

### 2.1 تباين `text-faint` — دون المعيار
- الوضع الفاتح: `#94a3b8` على خلفية `#ffffff` ≈ **2.56:1** (يفشل معيار AA البالغ 4.5:1 للنص العادي، بل ويفشل حتى حد 3:1 للنص الكبير).
- الوضع الداكن: `#6b7490` على `#1a1f33` ≈ **3.52:1** (لا يزال دون 4.5:1).
- يُستخدم هذا اللون على نصوص صغيرة (11–13px) في عناوين جداول وتسميات إحصائيات عبر عدة صفحات (`meetings`, `time-tracking`, `workflow-requests`, `workload`, لوحة التحكم الرئيسية).

---

## 3. حالات التحميل/الخطأ/الفراغ (Loading/Error/Empty States)

لا توجد أي ملفات `loading.tsx` أو `error.tsx` أو `not-found.tsx` على مستوى أي من مسارات `src/app/dashboard/**` الـ28. أي خطأ غير متوقع أو بطء في الجلب يسقط إلى واجهة Next الافتراضية غير المصممة وغير المدعومة بـRTL/العربية.

---

## 4. تغطية ميزات خطة V2 مقابل الوضع الحالي

| البند | الحالة | التفاصيل |
|---|---|---|
| Recurring Tasks | **جزئي** | الأعمدة `is_recurring`/`recurrence_pattern` موجودة وتُعرض في الواجهة، لكن لا يوجد أي pg_cron أو منطق يُنشئ نسخة مهمة جديدة فعليًا — بيانات وصفية فقط بلا تنفيذ. |
| Calendar | **جزئي** | العرض الشهري/الأسبوعي/اليومي يعمل بالكامل من الخادم، لكن لا يوجد Drag & Drop لتغيير الموعد — لا في `CalendarGrid` ولا عبر Server Action. |
| Projects | **مكتمل** | كل التبويبات السبعة (Overview/Tasks/Kanban/Milestones/Team/Files/Activity) موجودة وتعمل. |
| Comments/Collaboration | **جزئي** | إضافة/حذف تعليق فقط. لا Threading (`parent_id` غير موجود)، لا @mentions، لا تعديل، لا مرفقات على التعليق. |
| Attachments/Documents | **جزئي** | رفع/حذف يعمل عبر Storage، لكن بلا Versioning وبلا معاينة صور/PDF (رابط تنزيل فقط). |
| Notification Center | **جزئي** | تحديد مقروء/الكل موجود. لا تصفية حسب التصنيف، لا حذف فردي، لا تفضيلات إشعارات قابلة للتخصيص. |
| Organization Settings | **غير موجود** | لا يوجد مسار `/dashboard/settings` إطلاقًا، وجدول `organizations` يحتوي فقط `id/name/plan_type/created_at`. |
| Web Push | **غير موجود** | لا `push_subscriptions`، لا VAPID، لا أي أساس — نقطة بداية من الصفر بالكامل. |
| SaaS/Billing/Plans | **جزئي جدًا** | عمود `plan_type` (`free`/`paid`) فقط بلا أي جدول اشتراكات أو حدود استخدام أو تكامل دفع. |
| Platform Admin Console | **غير موجود** | `super_admin` الحالي مقيّد بمؤسسته فقط، لا يوجد مفهوم صلاحية عابرة للمؤسسات. |

---

## 5. توصية الأولوية للمرحلة التالية (P02)

البند **1.2** (تصعيد الصلاحيات عبر `users_self_update`) يجب إصلاحه أولًا وقبل أي عمل آخر — هذه ثغرة قابلة للاستغلال في الإنتاج الآن، وليست مجرد ملاحظة تصميمية. الإصلاح المباشر: تقييد التحديث عبر `SECURITY DEFINER` function (تسمح فقط بتحديث `full_name`/`phone`/`secondary_email`/`bio`/`avatar_url`) بدل سياسة `for update` المفتوحة على كل الأعمدة، بنفس نمط الحلول المستخدمة سابقًا في هذا المشروع (SLA/Workflow/Automation) — لا تُبتكر آلية صلاحيات جديدة.
