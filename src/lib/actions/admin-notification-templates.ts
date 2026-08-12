"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type TemplateFormState = { error?: string };

const MAX_NAME_LENGTH = 60;
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

function validateTemplateFields(name: string, title: string, message: string): string | null {
  if (!name) return "اسم القالب مطلوب";
  if (name.length > MAX_NAME_LENGTH) return `اسم القالب يجب ألا يتجاوز ${MAX_NAME_LENGTH} حرفًا`;
  if (!title) return "عنوان الإشعار مطلوب";
  if (title.length > MAX_TITLE_LENGTH) return `العنوان يجب ألا يتجاوز ${MAX_TITLE_LENGTH} حرفًا`;
  if (!message) return "نص الرسالة مطلوب";
  if (message.length > MAX_MESSAGE_LENGTH) return `الرسالة يجب ألا تتجاوز ${MAX_MESSAGE_LENGTH} حرفًا`;
  return null;
}

export async function createAdminNotificationTemplate(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإنشاء قوالب" };
  }

  const name = (formData.get("name") as string)?.trim() ?? "";
  const title = (formData.get("title") as string)?.trim() ?? "";
  const message = (formData.get("message") as string)?.trim() ?? "";
  const type = (formData.get("type") as string) || "general";
  const priority = (formData.get("priority") as string) || "normal";

  const validationError = validateTemplateFields(name, title, message);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("admin_notification_templates").insert({
    organization_id: profile.organization_id,
    created_by: profile.id,
    name,
    title,
    message,
    type,
    priority,
  });

  if (error) return { error: error.message || "تعذر إنشاء القالب" };

  revalidatePath("/dashboard/admin-notifications/templates");
  return {};
}

export async function updateAdminNotificationTemplate(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بتعديل القوالب" };
  }

  const name = (formData.get("name") as string)?.trim() ?? "";
  const title = (formData.get("title") as string)?.trim() ?? "";
  const message = (formData.get("message") as string)?.trim() ?? "";
  const type = (formData.get("type") as string) || "general";
  const priority = (formData.get("priority") as string) || "normal";

  const validationError = validateTemplateFields(name, title, message);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_notification_templates")
    .update({ name, title, message, type, priority })
    .eq("id", templateId);

  if (error) return { error: error.message || "تعذر تعديل القالب" };

  revalidatePath("/dashboard/admin-notifications/templates");
  return {};
}

export async function deleteAdminNotificationTemplate(templateId: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بحذف القوالب" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("admin_notification_templates").delete().eq("id", templateId);

  if (error) return { error: error.message || "تعذر حذف القالب" };

  revalidatePath("/dashboard/admin-notifications/templates");
  return {};
}
