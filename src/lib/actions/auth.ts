"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/email/resend";

export type SignInState = { error?: string };

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type SignUpState = { error?: string; needsConfirmation?: boolean };

/**
 * Email/password counterpart to the Google "إنشاء مؤسسة جديدة" path in
 * login-form.tsx - same destination (claim_new_organization), different
 * front door. Supabase's default project setting requires confirming the
 * address before a session exists, so `new_org` rides through
 * `emailRedirectTo` exactly like it rides through the Google OAuth
 * `redirectTo` today: the confirmation link lands on the very same
 * /auth/callback route, which already knows how to read `new_org` and call
 * claim_new_organization() after exchanging the code for a session - no
 * changes needed there. If email confirmation happens to be disabled on the
 * project, signUp() returns a session immediately, so that path is handled
 * here directly instead of leaving the user stuck on a redundant "check
 * your email" screen for a mail that was never sent.
 */
export async function signUpWithEmail(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const orgName = (formData.get("org_name") as string)?.trim();

  if (!email || !password || !orgName) {
    return { error: "جميع الحقول مطلوبة" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?new_org=${encodeURIComponent(orgName)}`,
    },
  });

  if (error) {
    return { error: "تعذّر إنشاء الحساب، حاول مرة أخرى" };
  }

  if (data.session) {
    await supabase.rpc("claim_new_organization", { p_org_name: orgName });
    redirect("/dashboard");
  }

  // Supabase returns an empty identities[] instead of an error for an email
  // that's already registered (anti-enumeration) - the same "check your
  // email" message correctly covers both a genuine new signup and this
  // case, without confirming to the caller which one happened.
  return { needsConfirmation: true };
}

/**
 * Email/password redemption of an organization invite (P16) - a separate
 * action rather than overloading signUpWithEmail (which hard-requires
 * org_name for the "create a new org" flow). Same shape otherwise: `invite`
 * rides through emailRedirectTo exactly like `new_org` does, and
 * /auth/callback already knows how to read it and call
 * redeem_organization_invite() after exchanging the code for a session.
 */
export async function signUpWithInvite(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const code = (formData.get("code") as string)?.trim();

  if (!email || !password || !code) {
    return { error: "جميع الحقول مطلوبة" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?invite=${encodeURIComponent(code)}`,
    },
  });

  if (error) {
    return { error: "تعذّر إنشاء الحساب، حاول مرة أخرى" };
  }

  if (data.session) {
    const { error: redeemError } = await supabase.rpc("redeem_organization_invite", { p_code: code });
    if (redeemError) return { error: redeemError.message };
    redirect("/dashboard");
  }

  return { needsConfirmation: true };
}

export type ChangePasswordState = { error?: string; success?: boolean };

const MIN_PASSWORD_LENGTH = 8;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const current = formData.get("current_password") as string;
  const next = formData.get("new_password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (!current || !next || !confirm) {
    return { error: "جميع الحقول مطلوبة" };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` };
  }
  if (next !== confirm) {
    return { error: "كلمة المرور الجديدة وتأكيدها غير متطابقين" };
  }
  if (next === current) {
    return { error: "كلمة المرور الجديدة مطابقة للحالية" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "الجلسة غير صالحة، أعد تسجيل الدخول" };
  }

  // Re-authenticate before changing the password: without this, anyone holding
  // a hijacked session could lock the real owner out of the account.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (reauthError) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }

  const { error } = await supabase.auth.updateUser({ password: next });

  if (error) {
    return { error: "تعذّر تغيير كلمة المرور، حاول مرة أخرى" };
  }

  return { success: true };
}

export type ChangeEmailState = { error?: string; success?: boolean };

/**
 * Supabase's "Secure email change" (on by default) requires confirming the
 * change from BOTH the old and new address before it takes effect, so
 * success here only means the two links were sent - the address hasn't
 * changed yet. Both links land on /auth/callback like every other auth code
 * exchange; sync_own_email.sql keeps public.users.email in step once they're
 * clicked. Re-checks the current password first, same rationale as
 * changePassword above.
 */
export async function changeEmail(
  _prevState: ChangeEmailState,
  formData: FormData
): Promise<ChangeEmailState> {
  const currentPassword = formData.get("current_password") as string;
  const newEmail = (formData.get("new_email") as string)?.trim();

  if (!currentPassword || !newEmail) {
    return { error: "جميع الحقول مطلوبة" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "الجلسة غير صالحة، أعد تسجيل الدخول" };
  }

  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    return { error: "البريد الجديد مطابق للحالي" };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (reauthError) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${getAppUrl()}/auth/callback` }
  );

  if (error) {
    return { error: "تعذّر إرسال روابط التأكيد، حاول مرة أخرى" };
  }

  return { success: true };
}

export type ResetPasswordState = { error?: string };

/**
 * Only reachable via /auth/update-password, which the reset-email link
 * lands on after /auth/callback already exchanged its code for a real
 * session - that recovery session (not knowledge of the old password) is
 * the proof of identity here, unlike changePassword above which re-checks
 * the current password for an already-logged-in user.
 */
export async function confirmPasswordReset(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const next = formData.get("new_password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (!next || !confirm) {
    return { error: "جميع الحقول مطلوبة" };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` };
  }
  if (next !== confirm) {
    return { error: "كلمة المرور وتأكيدها غير متطابقين" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "انتهت صلاحية الرابط، اطلب رابط إعادة تعيين جديدًا" };
  }

  const { error } = await supabase.auth.updateUser({ password: next });

  if (error) {
    return { error: "تعذّر تحديث كلمة المرور، حاول مرة أخرى" };
  }

  redirect("/dashboard");
}
