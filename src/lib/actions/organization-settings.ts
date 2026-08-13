"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type OrgSettingsFormState = { error?: string };
export type LogoUploadState = { error?: string; url?: string };
export type HolidayFormState = { error?: string };

const LOGO_BUCKET = "org-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

async function requireSuperAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") return null;
  return profile;
}

export async function updateOrganizationSettings(
  _prevState: OrgSettingsFormState,
  formData: FormData
): Promise<OrgSettingsFormState> {
  const profile = await requireSuperAdmin();
  if (!profile) return { error: "غير مصرح لك بتعديل إعدادات المؤسسة" };

  const name = (formData.get("name") as string)?.trim();
  const timezone = (formData.get("timezone") as string)?.trim();
  const workDays = (formData.getAll("work_days") as string[]).map(Number);
  const workStart = formData.get("work_start_time") as string;
  const workEnd = formData.get("work_end_time") as string;
  const defaultPriority = formData.get("default_task_priority") as string;
  const defaultSlaHours = Number(formData.get("default_sla_hours"));

  if (!name) return { error: "اسم المؤسسة مطلوب" };
  if (!timezone) return { error: "اختر المنطقة الزمنية" };
  if (workDays.length === 0) return { error: "اختر أيام العمل" };
  if (!workStart || !workEnd) return { error: "حدد ساعات العمل" };
  if (workStart >= workEnd) return { error: "وقت بداية العمل يجب أن يكون قبل وقت النهاية" };
  if (!VALID_PRIORITIES.includes(defaultPriority)) return { error: "اختر الأولوية الافتراضية" };
  if (!defaultSlaHours || defaultSlaHours <= 0) return { error: "مدة SLA الافتراضية يجب أن تكون أكبر من صفر" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      timezone,
      work_days: workDays,
      work_start_time: workStart,
      work_end_time: workEnd,
      default_task_priority: defaultPriority,
      default_sla_hours: defaultSlaHours,
    })
    .eq("id", profile.organization_id);

  if (error) return { error: error.message || "تعذر حفظ الإعدادات" };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function uploadOrganizationLogo(
  _prevState: LogoUploadState,
  formData: FormData
): Promise<LogoUploadState> {
  const profile = await requireSuperAdmin();
  if (!profile) return { error: "غير مصرح لك بتعديل إعدادات المؤسسة" };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "اختر صورة أولاً" };
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) return { error: "الشعار يجب أن يكون JPG أو PNG أو WEBP أو SVG" };
  if (file.size > MAX_LOGO_BYTES) return { error: "حجم الشعار يجب ألا يتجاوز 2 ميجابايت" };

  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const path = `${profile.organization_id}/${Date.now()}.${ext}`;

  const { data: org } = await supabase.from("organizations").select("logo_url").eq("id", profile.organization_id).single();
  const previousPath = org?.logo_url ? pathFromLogoUrl(org.logo_url) : null;

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "تعذر رفع الشعار، حاول مرة أخرى" };

  const { data: publicUrl } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_url: publicUrl.publicUrl })
    .eq("id", profile.organization_id);

  if (updateError) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { error: "تعذر حفظ الشعار" };
  }

  if (previousPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([previousPath]);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { url: publicUrl.publicUrl };
}

export async function removeOrganizationLogo(): Promise<OrgSettingsFormState> {
  const profile = await requireSuperAdmin();
  if (!profile) return { error: "غير مصرح لك بتعديل إعدادات المؤسسة" };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("logo_url").eq("id", profile.organization_id).single();
  if (!org?.logo_url) return {};

  const path = pathFromLogoUrl(org.logo_url);

  const { error } = await supabase.from("organizations").update({ logo_url: null }).eq("id", profile.organization_id);
  if (error) return { error: "تعذر حذف الشعار" };

  if (path) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return {};
}

function pathFromLogoUrl(url: string): string | null {
  const marker = `/${LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function addOrganizationHoliday(
  _prevState: HolidayFormState,
  formData: FormData
): Promise<HolidayFormState> {
  const profile = await requireSuperAdmin();
  if (!profile) return { error: "غير مصرح لك بتعديل إعدادات المؤسسة" };

  const name = (formData.get("name") as string)?.trim();
  const holidayDate = formData.get("holiday_date") as string;

  if (!name) return { error: "اسم العطلة مطلوب" };
  if (!holidayDate) return { error: "تاريخ العطلة مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase.from("organization_holidays").insert({
    organization_id: profile.organization_id,
    holiday_date: holidayDate,
    name,
  });

  if (error) {
    if (error.code === "23505") return { error: "يوجد عطلة مسجّلة بهذا التاريخ مسبقًا" };
    return { error: error.message || "تعذر إضافة العطلة" };
  }

  revalidatePath("/dashboard/settings");
  return {};
}

export async function deleteOrganizationHoliday(holidayId: string): Promise<HolidayFormState> {
  const profile = await requireSuperAdmin();
  if (!profile) return { error: "غير مصرح لك بتعديل إعدادات المؤسسة" };

  const supabase = await createClient();
  const { error } = await supabase.from("organization_holidays").delete().eq("id", holidayId);
  if (error) return { error: error.message || "تعذر حذف العطلة" };

  revalidatePath("/dashboard/settings");
  return {};
}
