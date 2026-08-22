"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
