-- TaskFlow Pro (MONJEZ) — Daily tool inventory ("جرد اليوم") per training
-- track. Replaces a shared Excel workbook (one sheet per track, a weekly
-- صباحي/مسائي/الكمية الفعلية grid) with real per-track, per-employee-scoped
-- pages. Run after schema.sql (needs current_org_id()/current_user_role()
-- from rls.sql and set_updated_at() from schema.sql).
--
-- total_quantity/morning_quantity/evening_quantity/actual_quantity are all
-- TEXT, not numeric: the real source data mixes actual counts (1, 25) with
-- unit descriptions ("لتر", "دستة") and status words ("مفقودة" = missing,
-- "نصف لفة" = half a roll) - forcing a number type would either crash on
-- import or silently drop real information.

-- ============================================================
-- inventory_tracks — one per "مسار" (training track), each with exactly
-- one responsible employee (assigned by super_admin, not hardcoded here -
-- the source spreadsheet never named an employee).
-- ============================================================
create table public.inventory_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  responsible_user_id uuid references public.users(id) on delete set null,
  -- which project this track's inventory tab shows under - a track with no
  -- project isn't surfaced anywhere in the UI until an admin links it from
  -- that project's "جرد الأدوات" tab (see inventory_project_link.sql).
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_tracks_organization_id_idx on public.inventory_tracks(organization_id);
create index inventory_tracks_responsible_user_id_idx on public.inventory_tracks(responsible_user_id);
create index inventory_tracks_project_id_idx on public.inventory_tracks(project_id);

alter table public.inventory_tracks enable row level security;

-- super_admin sees every track (oversight); everyone else only the track(s)
-- they're personally responsible for - never by department, since tracks
-- aren't department-scoped in this workbook.
create policy inventory_tracks_select on public.inventory_tracks
  for select using (
    organization_id = public.current_org_id()
    and (public.current_user_role() = 'super_admin' or responsible_user_id = auth.uid())
  );

create policy inventory_tracks_write on public.inventory_tracks
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- inventory_tools — the fixed tool list per track. Only super_admin
-- adds/edits/removes tools; the responsible employee only fills in daily
-- counts (inventory_daily_checks below).
-- ============================================================
create table public.inventory_tools (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.inventory_tracks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unit text,
  total_quantity text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index inventory_tools_track_id_idx on public.inventory_tools(track_id);
create index inventory_tools_organization_id_idx on public.inventory_tools(organization_id);

alter table public.inventory_tools enable row level security;

-- visibility follows the parent track exactly (same "exists on the parent
-- table" pattern already used for task_dependencies_select etc.)
create policy inventory_tools_select on public.inventory_tools
  for select using (
    exists (
      select 1 from public.inventory_tracks t
      where t.id = track_id
        and t.organization_id = public.current_org_id()
        and (public.current_user_role() = 'super_admin' or t.responsible_user_id = auth.uid())
    )
  );

create policy inventory_tools_write on public.inventory_tools
  for all using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- ============================================================
-- inventory_daily_checks — one row per (tool, day). Unique constraint
-- makes "save today's form" a plain upsert instead of an insert-only log,
-- while still keeping every past day queryable (confirmed: full history,
-- not just today).
-- ============================================================
create table public.inventory_daily_checks (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.inventory_tools(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  check_date date not null,
  morning_quantity text,
  evening_quantity text,
  actual_quantity text,
  checked_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tool_id, check_date)
);

create index inventory_daily_checks_tool_id_idx on public.inventory_daily_checks(tool_id);
create index inventory_daily_checks_organization_id_idx on public.inventory_daily_checks(organization_id);
create index inventory_daily_checks_check_date_idx on public.inventory_daily_checks(check_date);

alter table public.inventory_daily_checks enable row level security;

create policy inventory_daily_checks_select on public.inventory_daily_checks
  for select using (
    exists (
      select 1 from public.inventory_tools it
      join public.inventory_tracks t on t.id = it.track_id
      where it.id = tool_id
        and t.organization_id = public.current_org_id()
        and (public.current_user_role() = 'super_admin' or t.responsible_user_id = auth.uid())
    )
  );

-- write allowed for super_admin OR the track's own responsible employee -
-- the one place a non-admin can insert/update rows in this feature.
create policy inventory_daily_checks_write on public.inventory_daily_checks
  for all using (
    exists (
      select 1 from public.inventory_tools it
      join public.inventory_tracks t on t.id = it.track_id
      where it.id = tool_id
        and t.organization_id = public.current_org_id()
        and (public.current_user_role() = 'super_admin' or t.responsible_user_id = auth.uid())
    )
  );

create trigger inventory_daily_checks_set_updated_at
  before update on public.inventory_daily_checks
  for each row execute function public.set_updated_at();

-- ============================================================
-- Seed: the 5 real tracks + their daily-tracked tools, transcribed from
-- مركز_التدريب_جرد_الأدوات.xlsx's 5 primary sheets (the "(2)" duplicate
-- sheets and a stray Sheet1 in that workbook are fuller fixed-asset lists,
-- not part of the daily صباحي/مسائي/الكمية الفعلية check, so they're not
-- part of this seed). Idempotent: safe to re-run, skips tracks/tools that
-- already exist for the organization. responsible_user_id starts NULL for
-- every track - assign real employees afterward from the /dashboard/inventory
-- admin panel.
-- ============================================================
with target as (
  select (select id from public.organizations order by created_at limit 1) as org_id
),
tracks_seed(name) as (
  values
    ('مسار الحلاقة الرجالية'),
    ('مسار التجميل النسائي - كوافير'),
    ('مسار التطريز والخياطة'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية'),
    ('مسار الترجمة والعمل الحر الرقمي')
),
inserted_tracks as (
  insert into public.inventory_tracks (organization_id, name)
  select t.org_id, s.name
  from target t, tracks_seed s
  where not exists (
    select 1 from public.inventory_tracks it where it.organization_id = t.org_id and it.name = s.name
  )
  returning id, name
),
all_tracks as (
  select id, name from inserted_tracks
  union all
  select it.id, it.name from public.inventory_tracks it, target t where it.organization_id = t.org_id
),
tools_seed(track_name, position, tool_name, unit, total_quantity) as (
  values
    -- مسار الحلاقة الرجالية
    ('مسار الحلاقة الرجالية', 1, 'ماكنة موزر (النمر 1 +3)', null, '1'),
    ('مسار الحلاقة الرجالية', 2, 'طقم نمر 4 ((1+2+3+4)النمر)', null, '1'),
    ('مسار الحلاقة الرجالية', 3, 'ماكنة Kemi ((1+2+3+4)النمر)', null, '1'),
    ('مسار الحلاقة الرجالية', 4, 'ماكنة جيمي (شاحن)', null, '1'),
    ('مسار الحلاقة الرجالية', 5, 'ماكنة Vgr (كرتونة)', null, 'مفقودة'),
    ('مسار الحلاقة الرجالية', 6, 'فرشاة تك', null, '2'),
    ('مسار الحلاقة الرجالية', 7, 'فرشاة ناعمة', null, '2'),
    ('مسار الحلاقة الرجالية', 8, 'مقص', null, '5'),
    ('مسار الحلاقة الرجالية', 9, 'مشط تدريج', null, '4'),
    ('مسار الحلاقة الرجالية', 10, 'مشط تدريج شعر', null, '2'),
    ('مسار الحلاقة الرجالية', 11, 'ملاقط', null, '16'),
    ('مسار الحلاقة الرجالية', 12, 'فراشي ذقن', null, '5'),
    ('مسار الحلاقة الرجالية', 13, 'مشط كبير', null, '2'),
    ('مسار الحلاقة الرجالية', 14, 'صبانة بلاستيك', null, '3'),
    ('مسار الحلاقة الرجالية', 15, 'بخاخ مياه', null, '2'),
    ('مسار الحلاقة الرجالية', 16, 'مشط مكوبح', null, '8'),
    ('مسار الحلاقة الرجالية', 17, 'دفتر تشكيلة أمشاط', null, '8'),
    ('مسار الحلاقة الرجالية', 18, 'موس حلاقة', null, '25'),
    ('مسار الحلاقة الرجالية', 19, 'مريول', null, '8'),
    ('مسار الحلاقة الرجالية', 20, 'مناشف', null, '5'),
    ('مسار الحلاقة الرجالية', 21, 'معجون حلاقة', null, '12'),

    -- مسار التجميل النسائي - كوافير
    ('مسار التجميل النسائي - كوافير', 1, 'جهاز استشورا', null, '1'),
    ('مسار التجميل النسائي - كوافير', 2, 'جهاز فير', null, '1'),
    ('مسار التجميل النسائي - كوافير', 3, 'جهاز واكس شمع', null, '1'),
    ('مسار التجميل النسائي - كوافير', 4, 'امشاط شعر فرش', null, '2'),
    ('مسار التجميل النسائي - كوافير', 5, 'امشاط سشوار', null, '5'),
    ('مسار التجميل النسائي - كوافير', 6, 'امشاط', null, '22'),
    ('مسار التجميل النسائي - كوافير', 7, 'فرش صبغة', null, '8'),
    ('مسار التجميل النسائي - كوافير', 8, 'طقية ميش', null, '1'),
    ('مسار التجميل النسائي - كوافير', 9, 'طاقية نايلون مؤقتة', null, '12'),
    ('مسار التجميل النسائي - كوافير', 10, 'قلفز', null, '12'),
    ('مسار التجميل النسائي - كوافير', 11, 'كاب', null, '2'),
    ('مسار التجميل النسائي - كوافير', 12, 'صحون صبغة', null, '6'),
    ('مسار التجميل النسائي - كوافير', 13, 'شبك تساريح', null, '12'),
    ('مسار التجميل النسائي - كوافير', 14, 'صوف تساريح', null, '12'),
    ('مسار التجميل النسائي - كوافير', 15, 'صبغات', null, '12'),
    ('مسار التجميل النسائي - كوافير', 16, 'فرد شعر', null, '2'),
    ('مسار التجميل النسائي - كوافير', 17, 'بروتين', null, 'لتر'),
    ('مسار التجميل النسائي - كوافير', 18, 'شامبو', null, '4 لتر'),
    ('مسار التجميل النسائي - كوافير', 19, 'حمام زيت', null, '3'),
    ('مسار التجميل النسائي - كوافير', 20, 'كريم شعر', null, '1'),
    ('مسار التجميل النسائي - كوافير', 21, 'مثبت شعر', null, '3'),

    -- مسار التطريز والخياطة
    ('مسار التطريز والخياطة', 1, 'فلتر (ماكنة الحبكة)', null, '1'),
    ('مسار التطريز والخياطة', 2, 'مفك ابر (ماكنة الحبكة)', null, '1'),
    ('مسار التطريز والخياطة', 3, 'ملقط (ماكنة الحبكة)', null, '1'),
    ('مسار التطريز والخياطة', 4, 'مفك وسط (ماكنة الحبكة)', null, '1'),
    ('مسار التطريز والخياطة', 5, 'مفتاح ايلين (ماكنة الحبكة)', null, '6'),
    ('مسار التطريز والخياطة', 6, 'مفتاح شق (ماكنة الحبكة)', null, '3'),
    ('مسار التطريز والخياطة', 7, 'ابر ماكنة حبكة (ماكنة الحبكة)', null, 'دستة'),
    ('مسار التطريز والخياطة', 8, 'شفرة حبكة (ماكنة الحبكة)', null, '1'),
    ('مسار التطريز والخياطة', 9, 'مفتاح شق (ماكنة الدرزة)', null, '2'),
    ('مسار التطريز والخياطة', 10, 'مفك صغير (ماكنة الدرزة)', null, '1'),
    ('مسار التطريز والخياطة', 11, 'مفك وسط (ماكنة الدرزة)', null, '1'),
    ('مسار التطريز والخياطة', 12, 'مكوك (ماكنة الدرزة)', null, '2'),
    ('مسار التطريز والخياطة', 13, 'ابر دستة (ماكنة الدرزة)', null, '1'),
    ('مسار التطريز والخياطة', 14, 'مزيتة (ماكنة الدرزة)', null, '1'),
    ('مسار التطريز والخياطة', 15, 'مفتاح ايلين (ماكنة الابارات)', null, '6'),
    ('مسار التطريز والخياطة', 16, 'مفك صغير (ماكنة الابارات)', null, '1'),
    ('مسار التطريز والخياطة', 17, 'مفك وسط (ماكنة الابارات)', null, '1'),
    ('مسار التطريز والخياطة', 18, 'ابر (ماكنة الابارات)', null, '1'),
    ('مسار التطريز والخياطة', 19, 'فلتر لماكنة الابارات (ماكنة الابارات)', null, '1'),
    ('مسار التطريز والخياطة', 20, 'طقم براغي (ماكنة الابارات)', null, '1'),
    ('مسار التطريز والخياطة', 21, 'اشتكر 3 عيون', null, '5'),

    -- مسار صناعة الاكسسوارات والأشغال اليدوية
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 1, 'ورق A4 ملون', 'دستة', '1'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 2, 'ورق فوم لامع A4', 'دستة', '2'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 3, 'اعواد شوي خشبية', 'دستة', '10'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 4, 'أحبال خيش', 'لفة', '10'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 5, 'فوم بورد ابيض', 'لوح', '8'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 6, 'ورق بسكوت اصفر', 'لوح', '5'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 7, 'عرق الكرز', 'عرق', '4'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 8, 'شبر سيتان', 'لفة', '19'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 9, 'خيش عريض مع دانتيل', 'لفة', '5'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 10, 'ورق شجر بلاستيك', 'عرق', '4'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 11, 'ورق تغليف نايلون', 'دستة', '8'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 12, 'ورق تغليف خفيف', 'دستة', '6'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 13, 'ورق كريشه', 'لفة', '2'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 14, 'شبر سحاب', 'دستة', '3'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 15, 'خيط مطاطي', 'لفة', '20'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 16, 'حبل اكسسوارات بلاستيك غير مطاطي', 'لفة', '1'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 17, 'قماش كتان', 'متر', '5'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 18, 'سلسلة اكسسوار اسود', 'لفة', '1'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 19, 'سلسلة اكسسوار فضي', 'لفة', 'نصف لفة'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 20, 'لاصق دبل فيس ابيض', 'لفة', '8'),
    ('مسار صناعة الاكسسوارات والأشغال اليدوية', 21, 'لاصق دبل فيس شفاف', 'لفة', '20'),

    -- مسار الترجمة والعمل الحر الرقمي
    ('مسار الترجمة والعمل الحر الرقمي', 1, 'شاشة Konja 50 بوصة', null, '1'),
    ('مسار الترجمة والعمل الحر الرقمي', 2, 'ريموت شاشة', null, '1'),
    ('مسار الترجمة والعمل الحر الرقمي', 3, 'ستاند ابيض', null, '1'),
    ('مسار الترجمة والعمل الحر الرقمي', 4, 'اشتيكر 3 عيون', null, '6'),
    ('مسار الترجمة والعمل الحر الرقمي', 5, 'مساحة', null, '1'),
    ('مسار الترجمة والعمل الحر الرقمي', 6, 'طاولات خشبية', null, '9'),
    ('مسار الترجمة والعمل الحر الرقمي', 7, 'كرسي خشب', null, '1'),
    ('مسار الترجمة والعمل الحر الرقمي', 8, 'كرسي بلاستيك بدون ايد', null, '27'),
    ('مسار الترجمة والعمل الحر الرقمي', 9, 'وحدة انترنت', null, '1')
)
insert into public.inventory_tools (track_id, organization_id, name, unit, total_quantity, position)
select at.id, t.org_id, ts.tool_name, ts.unit, ts.total_quantity, ts.position
from tools_seed ts
join all_tracks at on at.name = ts.track_name
cross join target t
where not exists (
  select 1 from public.inventory_tools tool2 where tool2.track_id = at.id and tool2.name = ts.tool_name
);
