-- MONJEZ 3.0 P12 — Notification Center: personal preferences
-- Closes the recorded gap: strong infra (bell, admin broadcast, scheduling/
-- recurrence) but zero personal preferences (channels/DND/digest). There is
-- no shared "create_notification()" choke point - ~20 independent producers
-- across 15 SQL files each do their own raw `insert into notifications`. Not
-- one of them is touched here: a single BEFORE INSERT trigger on
-- notifications itself becomes the one place every producer's output passes
-- through, regardless of which function created the row.

-- ============================================================
-- 1) user_notification_preferences - a personal, self-service row. Unlike
--    role_permissions/organization_settings this needs no SECURITY DEFINER
--    function: it's strictly the caller's own single row, so plain
--    user_id = auth.uid() RLS is the correct (and simplest) boundary.
-- ============================================================

create table public.user_notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  muted_types text[] not null default '{}',
  dnd_enabled boolean not null default false,
  dnd_start_time time not null default '22:00',
  dnd_end_time time not null default '07:00',
  dnd_timezone text not null default 'Asia/Riyadh',
  digest_mode text not null default 'off' check (digest_mode in ('off', 'daily')),
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

create policy user_notification_preferences_select on public.user_notification_preferences
  for select using (user_id = auth.uid());

create policy user_notification_preferences_insert on public.user_notification_preferences
  for insert with check (user_id = auth.uid());

create policy user_notification_preferences_update on public.user_notification_preferences
  for update using (user_id = auth.uid());

-- ============================================================
-- 2) suppress_realtime: set by the trigger below, read by the one existing
--    realtime consumer (notification-bell.tsx) to decide whether to raise a
--    toast. The row is still created either way - DND/digest only ever
--    change how loudly it's delivered, never whether the user eventually
--    sees it in the bell/list.
-- ============================================================

alter table public.notifications
  add column if not exists suppress_realtime boolean not null default false;

create or replace function public.apply_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.user_notification_preferences;
  now_time time;
  in_dnd boolean;
begin
  select * into prefs from public.user_notification_preferences where user_id = new.user_id;

  if prefs.user_id is null then
    return new; -- no preferences row yet = every default (all on, no DND, no digest)
  end if;

  if new.type = any(prefs.muted_types) then
    return null; -- fully opted out of this type: the row is never created
  end if;

  if new.type <> 'digest_summary' then
    if prefs.dnd_enabled then
      now_time := (now() at time zone prefs.dnd_timezone)::time;
      if prefs.dnd_start_time < prefs.dnd_end_time then
        in_dnd := now_time >= prefs.dnd_start_time and now_time < prefs.dnd_end_time;
      else
        -- window crosses midnight (e.g. 22:00 -> 07:00)
        in_dnd := now_time >= prefs.dnd_start_time or now_time < prefs.dnd_end_time;
      end if;
      if in_dnd then
        new.suppress_realtime := true;
      end if;
    end if;

    if prefs.digest_mode = 'daily' then
      new.suppress_realtime := true;
    end if;
  end if;

  return new;
end;
$$;

create trigger notifications_apply_preferences
  before insert on public.notifications
  for each row execute function public.apply_notification_preferences();

-- ============================================================
-- 3) Daily digest: for users who chose digest_mode='daily', a single cron
--    sweep rolls up everything since their last digest into one summary
--    notification (which itself is exempt from suppression above, so it's
--    the one thing that does surface). Fixed run time, not per-user
--    customizable yet - see PROJECT(3).md for what's deferred.
-- ============================================================

create or replace function public.send_notification_digests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pref record;
  cnt int;
begin
  for pref in
    select * from public.user_notification_preferences
    where digest_mode = 'daily'
      and (last_digest_at is null or last_digest_at <= now() - interval '20 hours')
  loop
    select count(*) into cnt
    from public.notifications
    where user_id = pref.user_id
      and created_at > coalesce(pref.last_digest_at, now() - interval '1 day')
      and type <> 'digest_summary';

    if cnt > 0 then
      insert into public.notifications (user_id, type, title, message)
      values (
        pref.user_id,
        'digest_summary',
        'ملخصك اليومي',
        'لديك ' || cnt || ' إشعارًا جديدًا خلال آخر يوم. افتح مركز الإشعارات لمراجعتها.'
      );
    end if;

    update public.user_notification_preferences set last_digest_at = now() where user_id = pref.user_id;
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'send-notification-digests',
  '0 6 * * *',
  $$select public.send_notification_digests()$$
);
