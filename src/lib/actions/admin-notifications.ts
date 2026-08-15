"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { parseFormData } from "@/lib/foundation/validation";
import { can, assertCan } from "@/lib/foundation/permissions";
import { toActionError, PermissionError } from "@/lib/foundation/errors";
import { logActivity } from "@/lib/foundation/audit";
import { claimIdempotencyKey } from "@/lib/foundation/idempotency";
import { enforceRateLimit } from "@/lib/foundation/rate-limit";
import { emit } from "@/lib/foundation/events";

export type AdminNotificationFormState = { error?: string };

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

const composeSchema = z
  .object({
    title: z
      .string({ message: "عنوان الإشعار مطلوب" })
      .trim()
      .min(1, "عنوان الإشعار مطلوب")
      .max(MAX_TITLE_LENGTH, `العنوان يجب ألا يتجاوز ${MAX_TITLE_LENGTH} حرفًا`),
    message: z
      .string({ message: "نص الرسالة مطلوب" })
      .trim()
      .min(1, "نص الرسالة مطلوب")
      .max(MAX_MESSAGE_LENGTH, `الرسالة يجب ألا تتجاوز ${MAX_MESSAGE_LENGTH} حرفًا`),
    type: z.string().default("general"),
    priority: z.string().default("normal"),
    target_type: z.enum(["specific", "department", "all"], { message: "اختر المستلمين" }),
    department_id: z.string().optional(),
    user_id: z.array(z.string()).default([]),
    idempotency_key: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === "department" && !data.department_id) {
      ctx.addIssue({ code: "custom", message: "اختر القسم", path: ["department_id"] });
    }
    if (data.target_type === "specific" && data.user_id.length === 0) {
      ctx.addIssue({ code: "custom", message: "اختر موظفًا واحدًا على الأقل", path: ["user_id"] });
    }
  });

function assertSenderPermission(profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>, targetType: string) {
  assertCan(can.sendAdminNotification(profile), "غير مصرح لك بإرسال إشعارات إدارية");
  if (targetType === "all") {
    assertCan(can.sendAdminNotificationOrgWide(profile), "مدير القسم يستطيع الإرسال لقسمه فقط");
  }
}

export async function sendAdminNotification(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  let redirectPath: string;

  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new PermissionError("يجب تسجيل الدخول");

    const fields = parseFormData(composeSchema, formData, ["user_id"]);
    assertSenderPermission(profile, fields.target_type);

    const supabase = await createClient();

    // guards against a double form-submit (e.g. a slow confirm click fired
    // twice) sending the same broadcast twice - the form supplies one key
    // per confirm-dialog mount, not per keystroke, so legitimate resends of
    // identical content later are never blocked
    const idempotencyKey = fields.idempotency_key ? `admin_notification_send:${fields.idempotency_key}` : null;
    const alreadySent =
      idempotencyKey !== null &&
      !(await claimIdempotencyKey(supabase, idempotencyKey, profile.organization_id, profile.id));

    if (alreadySent) {
      revalidatePath("/dashboard/admin-notifications");
      redirectPath = "/dashboard/admin-notifications";
    } else {
      await enforceRateLimit(supabase, {
        bucketKey: `admin_notification_send:${profile.id}`,
        organizationId: profile.organization_id,
        userId: profile.id,
        limit: 10,
        windowSeconds: 300,
        message: "لقد أرسلت عددًا كبيرًا من الإشعارات في وقت قصير، حاول بعد قليل",
      });

      const { data: newId, error } = await supabase.rpc("send_admin_notification", {
        p_title: fields.title,
        p_message: fields.message,
        p_type: fields.type,
        p_priority: fields.priority,
        p_target_type: fields.target_type,
        p_department_id: fields.department_id ?? null,
        p_user_ids: fields.user_id,
      });

      if (error || !newId) {
        throw new Error(error?.message || "تعذر إرسال الإشعار");
      }

      const { data: sent } = await supabase
        .from("admin_notifications")
        .select("recipient_count")
        .eq("id", newId)
        .single();

      await logActivity(supabase, {
        organizationId: profile.organization_id,
        userId: profile.id,
        actionType: "admin_notification_sent",
        entityType: "admin_notification",
        entityId: newId,
        description: `أرسل إشعارًا إداريًا: "${fields.title}"`,
      });

      await emit("admin_notification.sent", {
        organizationId: profile.organization_id,
        userId: profile.id,
        notificationId: newId,
        recipientCount: sent?.recipient_count ?? fields.user_id.length,
      });

      revalidatePath("/dashboard/admin-notifications");
      redirectPath = `/dashboard/admin-notifications/${newId}`;
    }
  } catch (err) {
    return toActionError(err);
  }

  redirect(redirectPath);
}

export async function scheduleAdminNotification(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  let redirectPath: string;

  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new PermissionError("يجب تسجيل الدخول");

    const fields = parseFormData(composeSchema, formData, ["user_id"]);
    assertSenderPermission(profile, fields.target_type);

    const scheduledAtRaw = formData.get("scheduled_at") as string;
    if (!scheduledAtRaw) throw new Error("اختر وقت الإرسال");
    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new Error("وقت الجدولة يجب أن يكون في المستقبل");
    }

    const supabase = await createClient();
    const { data: newId, error } = await supabase.rpc("schedule_admin_notification", {
      p_title: fields.title,
      p_message: fields.message,
      p_type: fields.type,
      p_priority: fields.priority,
      p_target_type: fields.target_type,
      p_department_id: fields.department_id ?? null,
      p_user_ids: fields.user_id,
      p_scheduled_at: scheduledAt.toISOString(),
    });

    if (error || !newId) {
      throw new Error(error?.message || "تعذر جدولة الإشعار");
    }

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      userId: profile.id,
      actionType: "admin_notification_scheduled",
      entityType: "admin_notification",
      entityId: newId,
      description: `جدول إشعارًا إداريًا: "${fields.title}"`,
    });

    revalidatePath("/dashboard/admin-notifications");
    redirectPath = `/dashboard/admin-notifications/${newId}`;
  } catch (err) {
    return toActionError(err);
  }

  redirect(redirectPath);
}

export async function cancelScheduledAdminNotification(notificationId: string): Promise<{ error?: string }> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new PermissionError("يجب تسجيل الدخول");
    assertCan(can.sendAdminNotification(profile), "غير مصرح لك بهذا الإجراء");

    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_scheduled_admin_notification", {
      p_notification_id: notificationId,
    });
    if (error) throw new Error(error.message || "تعذر إلغاء الإشعار");

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      userId: profile.id,
      actionType: "admin_notification_cancelled",
      entityType: "admin_notification",
      entityId: notificationId,
    });
  } catch (err) {
    return toActionError(err);
  }

  revalidatePath("/dashboard/admin-notifications");
  revalidatePath(`/dashboard/admin-notifications/${notificationId}`);
  return {};
}

const RECURRENCE_PATTERNS = ["daily", "weekly", "monthly", "yearly"] as const;

export async function createAdminNotificationSeries(
  _prevState: AdminNotificationFormState,
  formData: FormData
): Promise<AdminNotificationFormState> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new PermissionError("يجب تسجيل الدخول");

    const fields = parseFormData(composeSchema, formData, ["user_id"]);
    assertSenderPermission(profile, fields.target_type);

    const pattern = formData.get("recurrence_pattern") as string;
    if (!RECURRENCE_PATTERNS.includes(pattern as (typeof RECURRENCE_PATTERNS)[number])) {
      throw new Error("اختر نمط التكرار");
    }
    const interval = Number(formData.get("recurrence_interval")) || 1;
    const daysOfWeekRaw = formData.getAll("recurrence_day") as string[];
    const daysOfWeek = pattern === "weekly" && daysOfWeekRaw.length > 0 ? daysOfWeekRaw.map(Number) : null;
    const endDateRaw = (formData.get("end_date") as string) || null;
    const firstRunRaw = formData.get("first_run_at") as string;

    if (!firstRunRaw) throw new Error("اختر وقت أول إرسال");
    const firstRunAt = new Date(firstRunRaw);
    if (Number.isNaN(firstRunAt.getTime()) || firstRunAt.getTime() <= Date.now()) {
      throw new Error("وقت أول إرسال يجب أن يكون في المستقبل");
    }

    const supabase = await createClient();
    const { data: newId, error } = await supabase.rpc("create_admin_notification_series", {
      p_title: fields.title,
      p_message: fields.message,
      p_type: fields.type,
      p_priority: fields.priority,
      p_target_type: fields.target_type,
      p_department_id: fields.department_id ?? null,
      p_user_ids: fields.user_id,
      p_pattern: pattern,
      p_interval: interval,
      p_days_of_week: daysOfWeek,
      p_end_date: endDateRaw,
      p_first_run_at: firstRunAt.toISOString(),
    });

    if (error || !newId) {
      throw new Error(error?.message || "تعذر إنشاء الإشعار المتكرر");
    }

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      userId: profile.id,
      actionType: "admin_notification_series_created",
      entityType: "admin_notification_series",
      entityId: newId,
      description: `أنشأ إشعارًا دوريًا متكررًا: "${fields.title}"`,
    });
  } catch (err) {
    return toActionError(err);
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
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new PermissionError("يجب تسجيل الدخول");
    assertCan(can.sendAdminNotification(profile), "غير مصرح لك بهذا الإجراء");

    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_admin_notification_series", { p_series_id: seriesId });
    if (error) throw new Error(error.message || "تعذر إلغاء الإشعار المتكرر");

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      userId: profile.id,
      actionType: "admin_notification_series_cancelled",
      entityType: "admin_notification_series",
      entityId: seriesId,
    });
  } catch (err) {
    return toActionError(err);
  }

  revalidatePath("/dashboard/admin-notifications");
  return {};
}
