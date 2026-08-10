-- TaskFlow Pro (MONJEZ 2.0) — Phase 12: Meetings
-- Run after projects_foundation.sql (meetings can optionally link to a
-- project) and calendar (Phase 11, no SQL of its own, just reads existing
-- data - this file is what gives it something new to read: meeting_date).
--
-- Attachments reuse the existing "task-attachments" Storage bucket (a
-- bucket is just a namespace, not tied to one Postgres table) instead of
-- creating a new bucket - only the metadata table is new, since
-- task_attachments.task_id is NOT NULL and specific to tasks, so it can't
-- represent a meeting's files without changing what that table means.

-- ============================================================
-- meetings + meeting_attendees
-- ============================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  organizer_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  meeting_time time,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

-- ============================================================
-- agenda (flat, ordered) and minutes (flat, each item convertible to a
-- task) - same "flat list" shape as task_checklists, not a nested doc
-- ============================================================
create table public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  position integer not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.meeting_minutes_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content text not null,
  -- set once by convert_minute_to_task() below; a non-null value both marks
  -- "already converted" (so it can't happen twice) and is the join back to
  -- the resulting task
  converted_task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.meeting_attachments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

create index meetings_organization_id_idx on public.meetings(organization_id);
create index meetings_meeting_date_idx on public.meetings(meeting_date);
create index meeting_attendees_meeting_id_idx on public.meeting_attendees(meeting_id);
create index meeting_agenda_items_meeting_id_idx on public.meeting_agenda_items(meeting_id);
create index meeting_minutes_items_meeting_id_idx on public.meeting_minutes_items(meeting_id);
create index meeting_attachments_meeting_id_idx on public.meeting_attachments(meeting_id);

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- ============================================================
-- is_meeting_attendee: SECURITY DEFINER for the same reason
-- is_project_member() is (Phase 02) - meetings_select needs to check
-- meeting_attendees, and meeting_attendees_select needs to check meetings;
-- a raw cross-table subquery in either policy would recurse into the
-- other's RLS forever. This bypasses that by reading meeting_attendees
-- directly, outside RLS.
-- ============================================================
create function public.is_meeting_attendee(p_meeting_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_attendees
    where meeting_id = p_meeting_id and user_id = auth.uid()
  );
$$;

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_agenda_items enable row level security;
alter table public.meeting_minutes_items enable row level security;
alter table public.meeting_attachments enable row level security;

create policy meetings_select on public.meetings
  for select using (
    organization_id = public.current_org_id() and (
      public.current_user_role() in ('super_admin', 'department_manager')
      or organizer_id = auth.uid()
      or public.is_meeting_attendee(id)
    )
  );

create policy meetings_insert on public.meetings
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('super_admin', 'department_manager')
    and organizer_id = auth.uid()
  );

create policy meetings_update on public.meetings
  for update using (
    organization_id = public.current_org_id()
    and (public.current_user_role() = 'super_admin' or organizer_id = auth.uid())
  );

create policy meetings_delete on public.meetings
  for delete using (
    organization_id = public.current_org_id() and public.current_user_role() = 'super_admin'
  );

-- children: visible whenever the parent meeting is visible (safe now that
-- meetings_select goes through the SECURITY DEFINER helper above instead
-- of querying meeting_attendees directly); writable by the organizer or
-- super_admin, same as project_milestones_write's shape.
create policy meeting_attendees_select on public.meeting_attendees
  for select using (exists (select 1 from public.meetings m where m.id = meeting_id));

create policy meeting_attendees_write on public.meeting_attendees
  for all using (
    exists (
      select 1 from public.meetings m where m.id = meeting_id
        and (public.current_user_role() = 'super_admin' or m.organizer_id = auth.uid())
    )
  );

create policy meeting_agenda_items_select on public.meeting_agenda_items
  for select using (exists (select 1 from public.meetings m where m.id = meeting_id));

create policy meeting_agenda_items_write on public.meeting_agenda_items
  for all using (
    exists (
      select 1 from public.meetings m where m.id = meeting_id
        and (public.current_user_role() = 'super_admin' or m.organizer_id = auth.uid())
    )
  );

create policy meeting_minutes_items_select on public.meeting_minutes_items
  for select using (exists (select 1 from public.meetings m where m.id = meeting_id));

create policy meeting_minutes_items_write on public.meeting_minutes_items
  for all using (
    exists (
      select 1 from public.meetings m where m.id = meeting_id
        and (public.current_user_role() = 'super_admin' or m.organizer_id = auth.uid())
    )
  );

-- attachments: anyone who can see the meeting can upload to it (mirrors
-- task_attachments_insert's own shape), but only the uploader or
-- super_admin can delete.
create policy meeting_attachments_select on public.meeting_attachments
  for select using (exists (select 1 from public.meetings m where m.id = meeting_id));

create policy meeting_attachments_insert on public.meeting_attachments
  for insert with check (
    exists (select 1 from public.meetings m where m.id = meeting_id) and uploaded_by = auth.uid()
  );

create policy meeting_attachments_delete on public.meeting_attachments
  for delete using (uploaded_by = auth.uid() or public.current_user_role() = 'super_admin');

-- ============================================================
-- activity_log: first real writer this project has had for this table
-- (it existed since schema.sql but nothing ever inserted into it) -
-- scoped to exactly what this phase asks for ("سجّل النشاط"), not a
-- retrofit of logging onto every existing feature.
-- ============================================================
create function public.log_meeting_activity()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (new.organization_id, new.organizer_id, 'create', 'meeting', new.id, 'إنشاء اجتماع: ' || new.title);
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (
      new.organization_id,
      coalesce(auth.uid(), new.organizer_id),
      'status_change', 'meeting', new.id,
      'تغيير حالة الاجتماع "' || new.title || '" إلى ' || new.status
    );
  end if;
  return new;
end;
$$;

create trigger meetings_log_activity
  after insert or update on public.meetings
  for each row execute function public.log_meeting_activity();

-- ============================================================
-- convert_minute_to_task: the phase's headline feature. SECURITY DEFINER
-- for atomicity across three writes (task insert, minute update, activity
-- log) and to re-check authorization itself rather than trusting the UI -
-- same reasoning as act_on_workflow_request()/update_department_employee().
-- ============================================================
create function public.convert_minute_to_task(
  p_minute_id uuid,
  p_assigned_to uuid,
  p_due_date date default null,
  p_priority text default 'medium'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  minute public.meeting_minutes_items;
  meeting public.meetings;
  caller uuid := auth.uid();
  caller_role text;
  new_task_id uuid;
begin
  select * into minute from public.meeting_minutes_items where id = p_minute_id;
  if minute is null then
    raise exception 'البند غير موجود';
  end if;
  if minute.converted_task_id is not null then
    raise exception 'تم تحويل هذا البند إلى مهمة مسبقًا';
  end if;
  if p_assigned_to is null then
    raise exception 'اختر الموظف المسند إليه';
  end if;

  select * into meeting from public.meetings where id = minute.meeting_id;
  select role into caller_role from public.users where id = caller;

  if caller_role != 'super_admin' and meeting.organizer_id != caller then
    raise exception 'غير مصرح لك بتحويل بنود هذا الاجتماع';
  end if;

  insert into public.tasks (organization_id, title, assigned_to, created_by, priority, status, due_date, project_id)
  values (
    meeting.organization_id, minute.content, p_assigned_to, caller,
    coalesce(p_priority, 'medium'), 'new', p_due_date, meeting.project_id
  )
  returning id into new_task_id;

  update public.meeting_minutes_items set converted_task_id = new_task_id where id = p_minute_id;

  insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
  values (meeting.organization_id, caller, 'convert_to_task', 'meeting', meeting.id, 'تحويل بند محضر إلى مهمة: ' || minute.content);

  return new_task_id;
end;
$$;
