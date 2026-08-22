-- Adds a WhatsApp number as its own field, separate from `phone` (many
-- people use a different number for each). Self-editing goes through
-- update_own_profile, the same whitelisted SECURITY DEFINER function every
-- other self-profile field uses (see fix_self_profile_update.sql) - the
-- signature changes, so the old 4-arg overload is dropped first rather than
-- left dangling alongside the new 5-arg one.

alter table public.users add column if not exists whatsapp text;

drop function if exists public.update_own_profile(text, text, text, text);

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_secondary_email text,
  p_bio text,
  p_whatsapp text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set full_name = p_full_name, phone = p_phone, secondary_email = p_secondary_email, bio = p_bio, whatsapp = p_whatsapp
  where id = auth.uid();
end;
$$;

revoke all on function public.update_own_profile(text, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, text, text) to authenticated;
