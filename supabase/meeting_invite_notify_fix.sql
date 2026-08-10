-- TaskFlow Pro (MONJEZ 2.0) — Fix: meeting invite notifications never wrote
-- Run after meeting_fixes.sql.
--
-- createMeeting()/addMeetingAttendee() inserted into notifications directly
-- from a regular Server Action - but that table has no INSERT policy for
-- ordinary users at all (see rls.sql's own comment: "rows are created by
-- SECURITY DEFINER trigger functions"). Every other notification in this
-- project (task events, SLA breaches, due-date/meeting reminders, workflow
-- approvals) already goes through a SECURITY DEFINER function for exactly
-- this reason; the invite notification just didn't, so the insert was
-- silently denied by RLS with no error surfaced in the app.
create function public.notify_meeting_invite(p_meeting_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting_id;
  if m is null then
    return;
  end if;

  insert into public.notifications (user_id, meeting_id, type, message)
  values (p_user_id, p_meeting_id, 'meeting_invited', 'تمت دعوتك إلى اجتماع "' || m.title || '" بتاريخ ' || m.meeting_date);
end;
$$;
