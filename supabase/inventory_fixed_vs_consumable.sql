-- TaskFlow Pro (MONJEZ) — split inventory tools into "ثابت" (fixed) vs
-- "مستهلك" (consumable), each with its own daily-check shape:
--
--   fixed:       الرصيد السابق (tools.total_quantity, static reference)
--                → الموجود فعليًا (found_quantity, entered daily)
--                → الفرق (computed: found - total_quantity)
--   consumable:  رصيد بداية اليوم (opening_balance - rolls forward from
--                yesterday's remaining, computed at read time, never
--                stored as "yesterday's value" anywhere)
--                → المستخدم (used_quantity) + التالف/المفقود (damaged_lost_quantity)
--                → المتبقي (computed: opening - used - damaged)
--
-- Replaces the previous morning_checked/evening_checked/actual_quantity
-- shape outright - still no real daily-check data exists yet for this
-- brand-new feature, so there's nothing to migrate.

alter table public.inventory_tools
  add column if not exists item_type text not null default 'fixed'
    check (item_type in ('fixed', 'consumable'));

alter table public.inventory_daily_checks
  drop column if exists morning_checked,
  drop column if exists evening_checked,
  drop column if exists actual_quantity,
  add column if not exists found_quantity text,
  add column if not exists opening_balance text,
  add column if not exists used_quantity text,
  add column if not exists damaged_lost_quantity text,
  add column if not exists notes text;
