"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/guards";
import { getCurrentProfile } from "@/lib/data/profile";

export type UserFormState = { error?: string };

export type AvatarUploadState = { error?: string; url?: string };

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Users manage their own photo only — there is no admin path to set someone
 * else's avatar, so this intentionally does not take a `requireRole` guard.
 */
export async function uploadAvatar(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: "الجلسة غير صالحة، أعد تسجيل الدخول" };
  }

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { error: "اختر صورة أولاً" };
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return { error: "الصورة يجب أن تكون JPG أو PNG أو WEBP" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "حجم الصورة يجب ألا يتجاوز 3 ميجابايت" };
  }

  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  // a fresh name per upload, so a cached copy of the old photo can't linger
  // anywhere the URL was already rendered
  const path = `${profile.id}/${Date.now()}.${ext}`;
  const previousPath = profile.avatar_url ? pathFromAvatarUrl(profile.avatar_url) : null;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: "تعذر رفع الصورة، حاول مرة أخرى" };
  }

  const { data: publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: publicUrl.publicUrl })
    .eq("id", profile.id);

  if (updateError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { error: "تعذر حفظ الصورة" };
  }

  if (previousPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  revalidatePath("/dashboard", "layout");
  return { url: publicUrl.publicUrl };
}

export async function removeAvatar(): Promise<UserFormState> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: "الجلسة غير صالحة، أعد تسجيل الدخول" };
  }
  if (!profile.avatar_url) return {};

  const supabase = await createClient();
  const path = pathFromAvatarUrl(profile.avatar_url);

  const { error } = await supabase.from("users").update({ avatar_url: null }).eq("id", profile.id);
  if (error) {
    return { error: "تعذر حذف الصورة" };
  }

  if (path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  }

  revalidatePath("/dashboard", "layout");
  return {};
}

function pathFromAvatarUrl(url: string): string | null {
  const marker = `/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export type UpdateOwnProfileState = { error?: string; success?: boolean };

/**
 * Every field a user can touch on their own record — full_name and phone
 * only. role/organization_id/department_id/is_active never appear in this
 * update call, by construction, regardless of what a form happens to submit:
 * that's the actual enforcement, the same way uploadAvatar above only ever
 * writes avatar_url. RLS (see supabase/self_profile_update.sql) is what lets
 * the row be touched at all; it isn't relied on to filter which columns a
 * client could smuggle in, since a USING/WITH CHECK clause on this table
 * can't see column-level intent, only whether the row may be written.
 */
export async function updateOwnProfile(
  _prevState: UpdateOwnProfileState,
  formData: FormData
): Promise<UpdateOwnProfileState> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: "الجلسة غير صالحة، أعد تسجيل الدخول" };
  }

  const fullName = (formData.get("full_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!fullName) {
    return { error: "الاسم مطلوب" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, phone })
    .eq("id", profile.id);

  if (error) {
    return { error: "تعذر حفظ التعديلات، حاول مرة أخرى" };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

const VALID_ROLES = ["super_admin", "department_manager", "employee"];

export async function createEmployee(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const profile = await requireRole(["super_admin"]);

  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const fullName = (formData.get("full_name") as string)?.trim();
  const role = formData.get("role") as string;
  const departmentId = (formData.get("department_id") as string) || null;
  const jobTitle = (formData.get("job_title") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!email || !password || !fullName || !role) {
    return { error: "جميع الحقول المطلوبة يجب تعبئتها" };
  }
  if (password.length < 8) {
    return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف" };
  }
  if (!VALID_ROLES.includes(role)) {
    return { error: "دور غير صالح" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      organization_id: profile.organization_id,
      role,
      full_name: fullName,
      department_id: departmentId,
      job_title: jobTitle,
      phone,
    },
  });

  if (error) {
    return { error: `تعذر إنشاء الحساب: ${error.message}` };
  }

  revalidatePath("/dashboard/employees");
  return {};
}

export async function updateEmployee(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireRole(["super_admin"]);

  const id = formData.get("id") as string;
  const fullName = (formData.get("full_name") as string)?.trim();
  const role = formData.get("role") as string;
  const departmentId = (formData.get("department_id") as string) || null;
  const jobTitle = (formData.get("job_title") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!fullName || !role) {
    return { error: "الاسم والدور مطلوبان" };
  }
  if (!VALID_ROLES.includes(role)) {
    return { error: "دور غير صالح" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      role,
      department_id: departmentId,
      job_title: jobTitle,
      phone,
    })
    .eq("id", id);

  if (error) {
    return { error: "تعذر تحديث بيانات الموظف" };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/profile/${id}`);
  return {};
}

export async function toggleEmployeeActive(id: string, isActive: boolean) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  await supabase.from("users").update({ is_active: isActive }).eq("id", id);

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/profile/${id}`);
}

export async function deleteEmployee(id: string): Promise<UserFormState> {
  const profile = await requireRole(["super_admin"]);

  if (id === profile.id) {
    return { error: "لا يمكنك حذف حسابك الخاص" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) {
    return {
      error: "تعذر حذف الموظف — تأكد من إعادة إسناد مهامه إلى موظف آخر أولاً",
    };
  }

  revalidatePath("/dashboard/employees");
  return {};
}
