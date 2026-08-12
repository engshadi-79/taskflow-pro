-- MONJEZ V2 — customizable "اختصارات سريعة" (Quick Shortcuts).
-- Run after fix_self_profile_update.sql (reuses the same pattern).
--
-- NULL means "no customization yet, show the role-based defaults" -
-- distinguishes a user who has genuinely emptied their shortcuts (an empty
-- array, `[]`) from one who never touched the feature at all.
--
-- Self-service update goes through a SECURITY DEFINER function that only
-- ever writes this one column, exactly like update_own_profile/
-- update_own_avatar (fix_self_profile_update.sql) - there is still no
-- direct UPDATE policy on users for a plain session, on purpose, so this
-- stays the only way to touch your own row at all.

alter table public.users add column dashboard_shortcuts jsonb;

create or replace function public.update_own_dashboard_shortcuts(p_shortcuts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set dashboard_shortcuts = p_shortcuts where id = auth.uid();
end;
$$;

revoke all on function public.update_own_dashboard_shortcuts(jsonb) from public;
grant execute on function public.update_own_dashboard_shortcuts(jsonb) to authenticated;
