-- TaskFlow Pro (MONJEZ) — rework daily inventory checks to match the
-- reference design: صباحي/مسائي are verification checkboxes (was this
-- tool physically checked this shift), not separate quantity readings -
-- only "الكمية الفعلية" is a real counted quantity. Also adds a group
-- label so tools can be grouped under a heading (e.g. by machine), like
-- the embroidery track's items already conceptually are.
--
-- Safe to run once, right after inventory.sql - no real daily-check rows
-- exist yet for this brand-new feature, so the old text columns are
-- dropped outright rather than kept around unused.

alter table public.inventory_daily_checks
  drop column if exists morning_quantity,
  drop column if exists evening_quantity,
  add column if not exists morning_checked boolean not null default false,
  add column if not exists evening_checked boolean not null default false;

alter table public.inventory_tools
  add column if not exists group_label text;

-- restore the embroidery track's tool names to their bare form and move
-- the "(ماكنة ...)" suffix added when it was first seeded into its own
-- group_label column, so the UI can render a real group-header row
-- instead of a parenthetical suffix in the name.
with target as (
  select
    (select id from public.organizations order by created_at limit 1) as org_id,
    (select id from public.inventory_tracks where organization_id = (select id from public.organizations order by created_at limit 1) and name = 'مسار التطريز والخياطة') as track_id
),
renames(old_name, new_name, group_label) as (
  values
    ('فلتر (ماكنة الحبكة)', 'فلتر', 'ماكنة الحبكة'),
    ('مفك ابر (ماكنة الحبكة)', 'مفك ابر', 'ماكنة الحبكة'),
    ('ملقط (ماكنة الحبكة)', 'ملقط', 'ماكنة الحبكة'),
    ('مفك وسط (ماكنة الحبكة)', 'مفك وسط', 'ماكنة الحبكة'),
    ('مفتاح ايلين (ماكنة الحبكة)', 'مفتاح ايلين', 'ماكنة الحبكة'),
    ('مفتاح شق (ماكنة الحبكة)', 'مفتاح شق', 'ماكنة الحبكة'),
    ('ابر ماكنة حبكة (ماكنة الحبكة)', 'ابر ماكنة حبكة', 'ماكنة الحبكة'),
    ('شفرة حبكة (ماكنة الحبكة)', 'شفرة حبكة', 'ماكنة الحبكة'),
    ('مفتاح شق (ماكنة الدرزة)', 'مفتاح شق', 'ماكنة الدرزة'),
    ('مفك صغير (ماكنة الدرزة)', 'مفك صغير', 'ماكنة الدرزة'),
    ('مفك وسط (ماكنة الدرزة)', 'مفك وسط', 'ماكنة الدرزة'),
    ('مكوك (ماكنة الدرزة)', 'مكوك', 'ماكنة الدرزة'),
    ('ابر دستة (ماكنة الدرزة)', 'ابر دستة', 'ماكنة الدرزة'),
    ('مزيتة (ماكنة الدرزة)', 'مزيتة', 'ماكنة الدرزة'),
    ('مفتاح ايلين (ماكنة الابارات)', 'مفتاح ايلين', 'ماكنة الابارات'),
    ('مفك صغير (ماكنة الابارات)', 'مفك صغير', 'ماكنة الابارات'),
    ('مفك وسط (ماكنة الابارات)', 'مفك وسط', 'ماكنة الابارات'),
    ('ابر (ماكنة الابارات)', 'ابر', 'ماكنة الابارات'),
    ('فلتر لماكنة الابارات (ماكنة الابارات)', 'فلتر لماكنة الابارات', 'ماكنة الابارات'),
    ('طقم براغي (ماكنة الابارات)', 'طقم براغي', 'ماكنة الابارات')
)
update public.inventory_tools tool
set name = r.new_name, group_label = r.group_label
from target t, renames r
where tool.track_id = t.track_id
  and tool.name = r.old_name;
