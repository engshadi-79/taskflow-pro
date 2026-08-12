-- MONJEZ — "ملاحظاتي" (My Notes): private per-user scratchpad, unrelated
-- to tasks/organization data. Every role gets one, not just `employee` -
-- these are personal notes, not organizational data, so no
-- super_admin/department_manager override policy like other tables have.

create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index personal_notes_user_id_idx on public.personal_notes(user_id, created_at desc);

alter table public.personal_notes enable row level security;

create policy personal_notes_select on public.personal_notes
  for select using (user_id = auth.uid());

create policy personal_notes_insert on public.personal_notes
  for insert with check (user_id = auth.uid());

create policy personal_notes_delete on public.personal_notes
  for delete using (user_id = auth.uid());
