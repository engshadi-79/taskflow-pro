# منجز (Monjez) — نظام إدارة المهام والموظفين

توثيق المشروع **كما هو مبنيّ فعلًا**، لا كما كان مخططًا. هذا الملف هو المرجع
العملي للحالة الحالية؛ أما `PROJECT_PLAN.md` فهو المواصفة الأصلية وبعض تفاصيله
لم تعد مطابقة للواقع (يذكر Next.js 14 والمشروع الآن على 16، ويذكر مكوّنات موبايل
لم تُبنَ بعد).

- **الإنتاج:** https://taskflow-pro-kappa-ruddy.vercel.app
- **المستودع:** `engshadi-79/taskflow-pro` (نشر تلقائي من `main` عبر Vercel)
- **اللغة والاتجاه:** عربي، RTL بالكامل

---

## 1. المكدس التقني

| الغرض | الأداة | الإصدار |
|---|---|---|
| الإطار | Next.js (App Router + Turbopack) | 16.3.0 |
| المكتبة | React | 19.2.8 |
| اللغة | TypeScript | ^5 |
| التنسيق | Tailwind CSS | ^4 |
| قاعدة البيانات + المصادقة | Supabase (PostgreSQL + RLS) | `@supabase/ssr` ^0.12.4 |
| الإشعارات الفورية | Supabase Realtime | — |
| تخزين الملفات | Supabase Storage | — |
| المهام المجدولة | pg_cron | — |
| تصدير Excel | exceljs | ^4.4.0 |
| الحركة | GSAP + `@gsap/react` | ^3.15.0 |
| الاستضافة | Vercel | — |

> Tailwind v4 هنا **لا يستخدم** `tailwind.config.js`. كل الرموز مُعرَّفة في
> `src/app/globals.css` داخل `@theme inline`.

---

## 2. متغيرات البيئة

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` **حسّاس** — يتجاوز RLS بالكامل. مكانه الوحيد
`.env.local` (مستثنى من git) ومتغيرات بيئة Vercel. لا يُكتب في كود مرفوع أبدًا،
ولا يُستخدم إلا في `src/lib/supabase/admin.ts` على السيرفر.

---

## 3. التشغيل محليًا

```bash
npm install
npm run dev
```

الأوامر: `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

---

## 4. الأدوار والصلاحيات

ثلاثة أدوار في عمود `users.role`:

| الدور | النطاق |
|---|---|
| `super_admin` | المنظمة كاملة — كل المهام والأقسام والموظفين |
| `department_manager` | قسمه فقط (يقرأ الفريق ولا يعدّله) |
| `employee` | مهامه المسندة إليه فقط |

الصلاحيات مفروضة على **ثلاث طبقات**، والأهم هي الأولى:

1. **RLS في قاعدة البيانات** (`supabase/rls.sql`) — خط الدفاع الحقيقي. تعتمد على
   الدوال المساعدة `current_user_role()` و `current_org_id()` و
   `current_department_id()`.
2. **حرّاس السيرفر** (`src/lib/actions/guards.ts` → `requireRole([...])`) —
   يرمي استثناءً قبل تنفيذ أي Server Action غير مصرّح به.
3. **إخفاء عناصر الواجهة** — تجميلي فقط. لا يُعتمد عليه للأمان.

> ملاحظة مهمة: جدول `notifications` **ليس له سياسة INSERT**. الصفوف تُنشأ فقط
> من مشغّلات `SECURITY DEFINER` في قاعدة البيانات، فلا يستطيع أي عميل تلفيق
> إشعار.

---

## 5. قاعدة البيانات

### الجداول

`organizations` · `departments` · `users` · `tasks` · `task_comments` ·
`task_attachments` · `task_templates` · `notifications` · `activity_log`

### القيم المحصورة

- **حالة المهمة:** `new` · `in_progress` · `pending_review` · `completed` · `overdue` · `cancelled`
- **الأولوية:** `low` · `medium` · `high` · `urgent`

### أنواع الإشعارات

مولّدة من المشغّلات، وكلها معروضة في القائمة المنسدلة للجرس:

`task_assigned` · `task_pending_review` · `task_completed` · `task_rejected` ·
`task_overdue` · و خمسة تذكيرات: `reminder_1week` · `reminder_3days` ·
`reminder_1day` · `reminder_2hours` · `reminder_30min`

### الدوال

| المجموعة | الدوال |
|---|---|
| مساعدات RLS | `current_user_role` · `current_org_id` · `current_department_id` |
| مشغّلات | `handle_new_user` · `notify_task_event` · `log_task_activity` · `set_updated_at` |
| مجدولة (pg_cron) | `mark_overdue_tasks` · `send_due_date_reminders` |
| تقارير | `report_top_employees` · `report_top_departments` · `report_avg_completion_hours` · `report_delay_rate` · `report_weekly_top_employees` · `report_weekly_trend` · `report_task_distribution_by_department` · `report_task_distribution_by_priority` |

### ترتيب تنفيذ ملفات SQL

مهم — الترتيب إلزامي:

```
supabase/schema.sql
supabase/rls.sql
supabase/storage.sql
supabase/notifications_and_reports.sql
supabase/dashboard_extras.sql
supabase/seed.sql          # بيانات تجريبية للأدوار الثلاثة
```

---

## 6. المسارات

| المسار | الوصول |
|---|---|
| `/` | عام — صفحة الهبوط (تحوّل المسجّل إلى الداشبورد) |
| `/login` | عام |
| `/dashboard` | كل الأدوار (المحتوى يختلف: الموظف يرى مهامه) |
| `/dashboard/tasks` · `/dashboard/tasks/new` | مدير عام + مدير قسم |
| `/dashboard/tasks/[id]` | كل الأدوار (محدود بـ RLS) |
| `/dashboard/kanban` | كل الأدوار |
| `/dashboard/employees` | مدير عام (تعديل) · مدير قسم (قراءة) |
| `/dashboard/departments` | مدير عام |
| `/dashboard/reports` | مدير عام + مدير قسم |
| `/dashboard/notifications` | كل الأدوار |
| `/dashboard/profile` · `/dashboard/profile/[id]` | كل الأدوار |
| `/api/reports/export` | مدير عام + مدير قسم (يرجع 403 لغير المصرّح) |

كل مسارات `/dashboard` تُحوّل غير المسجّل إلى `/login` بـ 307.

---

## 7. نظام التصميم

مبني على الهوية البصرية لبوابة ACAS بطلب من المالك.

### الرموز اللونية

معرّفة في `src/app/globals.css`. **أسماء الرموز ثابتة** ولا تُغيَّر — تُغيَّر
قيمها فقط، وهكذا لا تنكسر أي صفحة عند إعادة ضبط الهوية.

| الرمز | فاتح | الاستخدام |
|---|---|---|
| `--primary` / `--primary-2` | `#1e3c72` / `#2a5298` | الكحلي المؤسسي |
| `--accent-*` | `#6366f1` (500) | النيلي — اللون التفاعلي الأساسي |
| `--teal-*` | `#11998e` | التمييز الثانوي |
| `--sidebar` | `#151a2d` | الشريط الجانبي الغامق |
| `--background` / `--surface` | `#f8fafc` / `#ffffff` | الخلفية والأسطح |
| `--foreground` / `--muted` / `--faint` | `#1a202c` / `#64748b` / `#94a3b8` | النصوص |
| `--border` | `#e2e8f0` | الحدود |

لكل رمز مقابل في الوضع الليلي تحت `:root.dark`.

- **الخط:** Noto Kufi Arabic (واحد لكل شيء). `font-display` مُبقى كمرادف
  لـ `font-body` حتى لا تنكسر الاستخدامات القديمة.
- **تدرّجات اللافتات:** `.banner-violet` · `.banner-teal` · `.banner-navy`

### المكوّنات المشتركة

| المكوّن | الوصف |
|---|---|
| `shared/page-header.tsx` | لافتة متدرّجة (عنوان، وصف، أيقونة، شريحة عدد، مساحة إجراءات) + `HeaderChip` |
| `shared/stat-card.tsx` | بطاقة إحصاء بخط علوي ملوّن ورقم كبير — 7 نغمات |
| `shared/icons.tsx` | مجموعة أيقونات SVG. **لا إيموجي كأيقونات** |
| `shared/animated-background.tsx` | شبكة جزيئات على canvas |
| `dashboard/welcome-banner.tsx` | لافتة الترحيب بميدالية الحرف الأول |
| `dashboard/quick-shortcuts.tsx` | شريط الاختصارات السريعة |

### هيكل الواجهة

- **الشريط الجانبي** على اليمين، مطويّ بعرض 76px يُظهر الأيقونات فقط، ويتوسّع
  إلى 248px عند مرور الماوس أو دخول التركيز. يستخدم `position: fixed` ويطفو
  فوق المحتوى مع فاصل ثابت 76px — **لا إعادة تخطيط** عند التوسّع.
- **الشريط العلوي** بارتفاع 70px مطابق لرأس الشريط الجانبي، فيتشكّل خط أفقي
  واحد متصل.
- **جرس الإشعارات** يفتح قائمة منسدلة (رأس متدرّج، قائمة قابلة للتمرير، تحديد
  الكل كمقروء، تذييل يقود لصفحة الإشعارات)، تُغلق بالنقر خارجها أو بـ Escape.
- **البحث السريع** (لوحة أوامر) يُفتح بزر البحث أو **Ctrl/Cmd + K**. يبحث في
  المهام والموظفين والأقسام عبر عميل المتصفح فيبقى محصورًا بـ RLS، مع
  صفحات التنقّل، وسجلّ آخر عمليات البحث وآخر ما فُتح (في `localStorage`).
  بادئات التحديد: `t:` مهمة · `e:` موظف · `d:` قسم · `p:` صفحة.
  الاختصارات: ↑↓ تنقّل · Enter فتح · Ctrl+Enter تبويب جديد · Alt+1-9 فتح
  سريع · Escape إغلاق. الاستعلام مؤجَّل 220ms وبحدّ أدنى حرفين.
- **قائمة المستخدم** على بطاقة المستخدم: الملف الشخصي، تغيير كلمة المرور،
  إعدادات الحساب (مظهر الواجهة: فاتح/داكن/حسب النظام)، حول النظام، وتسجيل
  الخروج. الحوارات تستخدم `shared/modal.tsx`.

### تفضيل المظهر

`localStorage.theme` يقبل `light` · `dark` · `system`. سكربت الإقلاع في
`layout.tsx` يطبّقه قبل الترطيب (hydration)، ولذلك يحمل `<html>` الخاصية
`suppressHydrationWarning` — بدونها يشتكي React من عدم تطابق الخاصية بين
السيرفر والعميل. غياب القيمة يعني الوضع الفاتح (السلوك السابق، لم يُغيَّر).

### قواعد لا تُخالف

1. **التباين ≥ 4.5:1** لكل نص. تحقّقات مُنجَزة: القائمة الجانبية 9.31، العنصر
   النشط 6.29، النص الثانوي 4.76، النص الأساسي 15.6.
   ⚠️ `text-faint` = 2.56:1 على الأبيض — **يفشل** AA. لا يُستخدم لنص يُقرأ؛
   للحدود والأيقونات الزخرفية فقط.
2. **لا إيموجي كأيقونات** — تُستخدم `shared/icons.tsx`.
3. **كل حركة تحترم `prefers-reduced-motion`.**
4. **RTL:** انتبه أن `start` = اليمين و `end` = اليسار. الخطأ هنا يقلب التخطيط.
5. **الرموز فقط** — لا ألوان Tailwind الافتراضية للأسطح والنصوص، وإلا لن يعمل
   الوضع الليلي. (لذلك يوجد `brand-red-*` و `brand-blue-*` مرمّزان.)

---

## 8. مصائد تقنية موثّقة

أمور كلّفت وقتًا؛ توثيقها يمنع تكرارها.

### canvas المطلق لا يتمدّد مع `inset-0`

`<canvas>` عنصر **replaced** بأبعاد ذاتية 300×150. عند `position:absolute` مع
`width:auto` يستخدم CSS العرض الذاتي **ويتجاهل** الإزاحة المقابلة. النتيجة:
كانفاس بعرض 300px (أو أي قياس خاطئ يُثبَّت من الجافاسكربت) بدل ملء الأب.

**الحل المتّبع:** الحجم من CSS (`h-full w-full`)، والجافاسكربت يضبط
الـ backing store فقط من داخل حلقة الرسم. لا `ResizeObserver`.

### لوحة المعاينة لا ترسم إطارات

في بيئة التطوير الآلية تكون الصفحة `document.hidden = true`، فـ
`requestAnimationFrame` لا يعمل، وحركات CSS لا تتقدّم، وقيم `color-mix`
المحسوبة على عناصر قائمة قد تبقى قديمة بعد تغيير الثيم. هذا **ليس خللًا في
التطبيق**. عند الفحص: اعتمد على ما يُنفَّذ تزامنيًا، أو أنشئ عناصر جديدة، أو
عطّل الحركة قبل القياس.

### الدفع إلى GitHub بتوكن

لا تستخدم `-u` مع رابط يحمل توكن — يكتب التوكن في `.git/config`.

```bash
git push "https://TOKEN@github.com/OWNER/REPO.git" main:main
```

ثم تحقّق: `git config --local --list | grep ghp_` يجب أن يكون فارغًا.

---

## 9. بنية المجلدات

```
src/
├── app/
│   ├── globals.css              # رموز التصميم + @theme inline
│   ├── layout.tsx               # RTL + الخط + سكربت الثيم
│   ├── page.tsx                 # صفحة الهبوط
│   ├── login/
│   ├── dashboard/               # layout + الصفحات
│   └── api/reports/export/
├── components/
│   ├── landing/
│   ├── dashboard/
│   └── shared/
└── lib/
    ├── actions/                 # Server Actions + guards
    ├── data/                    # قرّاء (getCurrentProfile)
    ├── supabase/                # client · server · admin
    └── types/
supabase/                        # ملفات SQL
```

---

## 10. النشر

الدفع إلى `main` يُطلق نشرًا تلقائيًا على Vercel. متغيرات البيئة الثلاثة يجب
أن تكون مضبوطة في إعدادات مشروع Vercel.

للتحقق من وصول نشرة فعلًا (مفيد لأن الأصول مُهشَّمة الأسماء):

```bash
curl -s https://taskflow-pro-kappa-ruddy.vercel.app/login | grep -o 'noto_kufi_arabic[^ "]*'
```

---

## 11. أعمال لم تُنجز بعد

- **فحص الصفحات الداخلية للأدوار الثلاثة على الإنتاج** — لم يُنجَز؛ يتطلب
  تسجيل دخول فعلي. المسارات العامة والتحويلات مفحوصة.
- **تطبيق الموبايل (Capacitor)** و **OneSignal** و **AdMob** — مذكورة في
  المواصفة الأصلية، لم تُبنَ.
- **قفل الشاشة** — عنصر موجود في بوابة ACAS ولم يُنفَّذ. قفلٌ من طرف العميل
  يمكن تجاوزه بإعادة التحميل أو بالانتقال المباشر، فهو ليس حدًّا أمنيًا
  حقيقيًا. يحتاج قرارًا: إما قبوله كحماية من النظر العابر فقط، أو بناؤه
  فعليًا على السيرفر.
- **`text-faint`** مستخدم في أماكن سابقة بتباين تحت الحد؛ يستحق مراجعة شاملة.
