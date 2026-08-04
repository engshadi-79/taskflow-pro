"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/guards";

export type UserFormState = { error?: string };

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
