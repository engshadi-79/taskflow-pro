"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type AdminNotificationFormState = { error?: string };

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

export async function sendAdminNotification(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإرسال إشعارات إدارية" };
  }

  const title = (formData.get("title") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const type = (formData.get("type") as string) || "general";
  const priority = (formData.get("priority") as string) || "normal";
  const targetType = formData.get("target_type") as string;
  const departmentId = (formData.get("department_id") as string) || null;
  const userIds = formData.getAll("user_id") as string[];

  if (!title) return { error: "عنوان الإشعار مطلوب" };
  if (title.length > MAX_TITLE_LENGTH) return { error: `العنوان يجب ألا يتجاوز ${MAX_TITLE_LENGTH} حرفًا` };
  if (!message) return { error: "نص الرسالة مطلوب" };
  if (message.length > MAX_MESSAGE_LENGTH) return { error: `الرسالة يجب ألا تتجاوز ${MAX_MESSAGE_LENGTH} حرفًا` };
  if (!targetType) return { error: "اختر المستلمين" };
  if (targetType === "department" && !departmentId) return { error: "اختر القسم" };
  if (targetType === "specific" && userIds.length === 0) return { error: "اختر موظفًا واحدًا على الأقل" };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("send_admin_notification", {
    p_title: title,
    p_message: message,
    p_type: type,
    p_priority: priority,
    p_target_type: targetType,
    p_department_id: departmentId,
    p_user_ids: userIds,
  });

  if (error || !newId) {
    return { error: error?.message || "تعذر إرسال الإشعار" };
  }

  revalidatePath("/dashboard/admin-notifications");
  redirect(`/dashboard/admin-notifications/${newId}`);
}
