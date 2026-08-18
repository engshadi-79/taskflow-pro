-- TaskFlow Pro (MONJEZ) — link inventory tracks to a specific project.
-- Run after inventory.sql. The inventory feature moves from a standalone
-- sidebar page into a tab on the linked project's own detail page - a
-- track with no project_id simply isn't shown anywhere until an admin
-- links it from that project's "جرد الأدوات" tab.
--
-- Visibility (who can see a track's daily checklist) is unchanged - still
-- super_admin or the track's own responsible_user_id, per inventory.sql.
-- project_id only controls WHERE in the UI the track surfaces, not WHO can
-- see it.
alter table public.inventory_tracks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists inventory_tracks_project_id_idx on public.inventory_tracks(project_id);
