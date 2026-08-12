"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type AdminNotificationFormState = { error?: string };

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

function readComposeFields(formData: FormData) {
  return {
    title: (formData.get("title") as string)?.trim() ?? "",
    message: (formData.get("message") as string)?.trim() ?? "",
    type: (formData.get("type") as string) || "general",
    priority: (formData.get("priority") as string) || "normal",
    targetType: formData.get("target_type") as string,
    departmentId: (formData.get("department_id") as string) || null,
    userIds: formData.getAll("user_id") as string[],
  };
}

function validateComposeFields(fields: ReturnType<typeof readComposeFields>): string | null {
  if (!fields.title) return "عنوان الإشعار مطلوب";
  if (fields.title.length > MAX_TITLE_LENGTH) return `العنوان يجب ألا يتجاوز ${MAX_TITLE_LENGTH} حرفًا`;
  if (!fields.message) return "نص الرسالة مطلوب";
  if (fields.message.length > MAX_MESSAGE_LENGTH) return `الرسالة يجب ألا تتجاوز ${MAX_MESSAGE_LENGTH} حرفًا`;
  if (!fields.targetType) return "اختر المستلمين";
  if (fields.targetType === "department" && !fields.departmentId) return "اختر القسم";
  if (fields.targetType === "specific" && fields.userIds.length === 0) return "اختر موظفًا واحدًا على الأقل";
  return null;
}

export async function sendAdminNotification(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإرسال إشعارات إدارية" };
  }

  const fields = readComposeFields(formData);
  const validationError = validateComposeFields(fields);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("send_admin_notification", {
    p_title: fields.title,
    p_message: fields.message,
    p_type: fields.type,
    p_priority: fields.priority,
    p_target_type: fields.targetType,
    p_department_id: fields.departmentId,
    p_user_ids: fields.userIds,
  });

  if (error || !newId) {
    return { error: error?.message || "تعذر إرسال الإشعار" };
  }

  revalidatePath("/dashboard/admin-notifications");
  redirect(`/dashboard/admin-notifications/${newId}`);
}

export async function scheduleAdminNotification(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإرسال إشعارات إدارية" };
  }

  const fields = readComposeFields(formData);
  const validationError = validateComposeFields(fields);
  if (validationError) return { error: validationError };

  const scheduledAtRaw = formData.get("scheduled_at") as string;
  if (!scheduledAtRaw) return { error: "اختر وقت الإرسال" };
  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return { error: "وقت الجدولة يجب أن يكون في المستقبل" };
  }

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("schedule_admin_notification", {
    p_title: fields.title,
    p_message: fields.message,
    p_type: fields.type,
    p_priority: fields.priority,
    p_target_type: fields.targetType,
    p_department_id: fields.departmentId,
    p_user_ids: fields.userIds,
    p_scheduled_at: scheduledAt.toISOString(),
  });

  if (error || !newId) {
    return { error: error?.message || "تعذر جدولة الإشعار" };
  }

  revalidatePath("/dashboard/admin-notifications");
  redirect(`/dashboard/admin-notifications/${newId}`);
}

export async function cancelScheduledAdminNotification(notificationId: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_scheduled_admin_notification", {
    p_notification_id: notificationId,
  });

  if (error) return { error: error.message || "تعذر إلغاء الإشعار" };

  revalidatePath("/dashboard/admin-notifications");
  revalidatePath(`/dashboard/admin-notifications/${notificationId}`);
  return {};
}

const RECURRENCE_PATTERNS = ["daily", "weekly", "monthly", "yearly"] as const;

export async function createAdminNotificationSeries(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإرسال إشعارات إدارية" };
  }

  const fields = readComposeFields(formData);
  const validationError = validateComposeFields(fields);
  if (validationError) return { error: validationError };

  const pattern = formData.get("recurrence_pattern") as string;
  if (!RECURRENCE_PATTERNS.includes(pattern as (typeof RECURRENCE_PATTERNS)[number])) {
    return { error: "اختر نمط التكرار" };
  }
  const interval = Number(formData.get("recurrence_interval")) || 1;
  const daysOfWeekRaw = formData.getAll("recurrence_day") as string[];
  const daysOfWeek = pattern === "weekly" && daysOfWeekRaw.length > 0 ? daysOfWeekRaw.map(Number) : null;
  const endDateRaw = (formData.get("end_date") as string) || null;
  const firstRunRaw = formData.get("first_run_at") as string;

  if (!firstRunRaw) return { error: "اختر وقت أول إرسال" };
  const firstRunAt = new Date(firstRunRaw);
  if (Number.isNaN(firstRunAt.getTime()) || firstRunAt.getTime() <= Date.now()) {
    return { error: "وقت أول إرسال يجب أن يكون في المستقبل" };
  }

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("create_admin_notification_series", {
    p_title: fields.title,
    p_message: fields.message,
    p_type: fields.type,
    p_priority: fields.priority,
    p_target_type: fields.targetType,
    p_department_id: fields.departmentId,
    p_user_ids: fields.userIds,
    p_pattern: pattern,
    p_interval: interval,
    p_days_of_week: daysOfWeek,
    p_end_date: endDateRaw,
    p_first_run_at: firstRunAt.toISOString(),
  });

  if (error || !newId) {
    return { error: error?.message || "تعذر إنشاء الإشعار المتكرر" };
  }

  revalidatePath("/dashboard/admin-notifications");
  redirect("/dashboard/admin-notifications");
}

export async function submitAdminNotification(
  prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  const mode = formData.get("send_mode") as string;
  if (mode === "scheduled") return scheduleAdminNotification(prevState, formData);
  if (mode === "recurring") return createAdminNotificationSeries(prevState, formData);
  return sendAdminNotification(prevState, formData);
}

export async function cancelAdminNotificationSeries(seriesId: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_admin_notification_series", { p_series_id: seriesId });

  if (error) return { error: error.message || "تعذر إلغاء الإشعار المتكرر" };

  revalidatePath("/dashboard/admin-notifications");
  return {};
}
