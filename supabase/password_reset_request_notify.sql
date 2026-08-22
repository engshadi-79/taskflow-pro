-- "Forgot password" without depending on outbound email working. Resend is
-- still in sandbox mode (only delivers to the account owner's own address),
-- so a real reset-email link can't reach actual employees yet - see
-- confirmPasswordReset in src/lib/actions/auth.ts for that path, which stays
-- as-is for once a domain gets verified. This is the fallback that works
-- today: an unauthenticated visitor on /login can ask their org's
-- super_admin(s) to reset the password for them instead, using the
-- super_admin-set-password button already built (resetEmployeePassword in
-- src/lib/actions/users.ts). Reuses the existing notifications table/bell -
-- no new table or UI surface needed.
create or replace function public.request_password_reset(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
begin
  select id, full_name, organization_id into v_user
  from public.users
  where email = lower(trim(p_email)) and is_active = true
  limit 1;

  -- Silently no-ops for an unknown/inactive email - same shape as a
  -- successful call either way, so this can't be used to test which emails
  -- exist in the system.
  if v_user.id is not null then
    insert into public.notifications (user_id, type, message)
    select u.id, 'password_reset_request',
      v_user.full_name || ' طلب إعادة تعيين كلمة مروره — من صفحته الشخصية اضغط "تعيين كلمة مرور جديدة"'
    from public.users u
    where u.organization_id = v_user.organization_id and u.role = 'super_admin' and u.is_active = true;
  end if;
end;
$$;

revoke all on function public.request_password_reset(text) from public;
grant execute on function public.request_password_reset(text) to anon, authenticated;
