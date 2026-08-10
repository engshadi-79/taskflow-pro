-- TaskFlow Pro (MONJEZ 2.0) — Meeting fixes: organizer visibility + reminders
-- Run after meetings.sql.
--
-- Fix 1: "المنظم" showed "—" for anyone outside the organizer's own
-- department. users_select (rls.sql) restricts a department_manager to
-- their own department + self, and an employee to just self - so a plain
-- embedded PostgREST join (organizer:users(full_name)) silently returns
-- null whenever the viewer can see the MEETING but not that specific
-- users row, which is exactly the case for any cross-department meeting.
-- A SECURITY DEFINER function bypasses that, but re-derives
-- meetings_select's own visibility rule first, so it never leaks an
-- organizer's name for a meeting the caller couldn't see anyway.
create or replace function public.meetings_organizer_names(p_meeting_ids uuid[])
returns table (meeting_id uuid, organizer_name text)
language sql
security definer
stable
set search_path = public
as $$
  select m.id, u.full_name
  from public.meetings m
  join public.users u on u.id = m.organizer_id
  where m.id = any(p_meeting_ids)
    and m.organization_id = public.current_org_id()
    and (
      public.current_user_role() in ('super_admin', 'department_manager')
      or m.organizer_id = auth.uid()
      or public.is_meeting_attendee(m.id)
    );
$$;

-- Same problem, same fix, for the detail page: it also embeds
-- project:projects(name), and projects_select restricts a viewer to their
-- own department's projects or ones they're a member of - a meeting linked
-- to a project outside that scope would silently null the project name out
-- too, for the same reason the organizer name did.
create or replace function public.meeting_detail_extra(p_meeting_id uuid)
returns table (organizer_name text, project_name text)
language sql
security definer
stable
set search_path = public
as $$
  select u.full_name, p.name
  from public.meetings m
  join public.users u on u.id = m.organizer_id
  left join public.projects p on p.id = m.project_id
  where m.id = p_meeting_id
    and m.organization_id = public.current_org_id()
    and (
      public.current_user_role() in ('super_admin', 'department_manager')
      or m.organizer_id = auth.uid()
      or public.is_meeting_attendee(m.id)
    );
$$;

-- Fix 2: meeting notifications. notifications had no way to reference a
-- meeting (only task_id) - a real column, not a text-parsing hack, is
-- what dedupe needs, same reasoning as adding responded_at/estimated_hours
-- earlier in this project when a real column was genuinely missing.
alter table public.notifications
  add column if not exists meeting_id uuid references public.meetings(id) on delete cascade;

-- Reminders before a meeting starts, same dedupe-by-not-exists shape as
-- send_due_date_reminders() (notifications_and_reports.sql) and
-- notify_sla_breaches() (sla_engine.sql) - each lead time fires at most
-- once per (meeting, recipient). A meeting with no meeting_time is
-- treated as starting at 09:00 - unlike a task's missing due_time
-- (defaulted to end-of-day, since that's a deadline), a meeting is
-- something people attend, and "end of day" would fire the 1-hour
-- reminder at 22:59 with no evidence anyone actually meant that.
create function public.send_meeting_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reminder_window record;
begin
  for reminder_window in
    select * from (values
      ('meeting_reminder_1day', interval '1 day'),
      ('meeting_reminder_1hour', interval '1 hour')
    ) as w(reminder_type, lead_time)
  loop
    insert into public.notifications (user_id, meeting_id, type, message)
    select recipient.user_id, m.id, reminder_window.reminder_type,
      'تذكير: اجتماع "' || m.title || '" يبدأ قريبًا'
    from public.meetings m
    join lateral (
      select user_id from public.meeting_attendees a where a.meeting_id = m.id
      union
      select m.organizer_id
    ) as recipient on true
    where m.status = 'scheduled'
      and (m.meeting_date + coalesce(m.meeting_time, '09:00:00'::time)) <= now() + reminder_window.lead_time
      and (m.meeting_date + coalesce(m.meeting_time, '09:00:00'::time)) > now()
      and not exists (
        select 1 from public.notifications n
        where n.meeting_id = m.id and n.user_id = recipient.user_id and n.type = reminder_window.reminder_type
      );
  end loop;
end;
$$;

select cron.schedule(
  'send-meeting-reminders',
  '*/15 * * * *',
  $$select public.send_meeting_reminders()$$
);
