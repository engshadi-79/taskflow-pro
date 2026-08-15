"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import type { Priority } from "@/lib/types/task";

export type SlaFormState = { error?: string };

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

function parsePolicyFields(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const priority = formData.get("priority") as Priority;
  const responseMinutes = Number(formData.get("response_minutes"));
  const resolutionMinutes = Number(formData.get("resolution_minutes"));
  return { name, priority, responseMinutes, resolutionMinutes };
}

export async function createSlaPolicy(
  _prevState: SlaFormState,
  formData: FormData
): Promise<SlaFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageSlaPolicies(profile)) {
    return { error: "غير مصرح لك بإدارة سياسات SLA" };
  }

  const { name, priority, responseMinutes, resolutionMinutes } = parsePolicyFields(formData);

  if (!name) return { error: "اسم السياسة مطلوب" };
  if (!VALID_PRIORITIES.includes(priority)) return { error: "أولوية غير صالحة" };
  if (!responseMinutes || responseMinutes <= 0) return { error: "وقت الاستجابة يجب أن يكون رقمًا موجبًا" };
  if (!resolutionMinutes || resolutionMinutes <= 0) return { error: "وقت الإنجاز يجب أن يكون رقمًا موجبًا" };

  const supabase = await createClient();
  const { error } = await supabase.from("sla_policies").insert({
    organization_id: profile.organization_id,
    name,
    priority,
    response_minutes: responseMinutes,
    resolution_minutes: resolutionMinutes,
  });

  if (error) {
    // most likely sla_policies_org_priority_active_idx - an active policy
    // for this priority already exists
    return { error: error.message || "تعذر إنشاء السياسة (قد توجد سياسة نشطة لهذه الأولوية)" };
  }

  revalidatePath("/dashboard/sla-policies");
  return {};
}

export async function updateSlaPolicy(
  _prevState: SlaFormState,
  formData: FormData
): Promise<SlaFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageSlaPolicies(profile)) {
    return { error: "غير مصرح لك بإدارة سياسات SLA" };
  }

  const id = formData.get("id") as string;
  // priority is intentionally not read here - see the comment below
  const { name, responseMinutes, resolutionMinutes } = parsePolicyFields(formData);

  if (!name) return { error: "اسم السياسة مطلوب" };
  if (!responseMinutes || responseMinutes <= 0) return { error: "وقت الاستجابة يجب أن يكون رقمًا موجبًا" };
  if (!resolutionMinutes || resolutionMinutes <= 0) return { error: "وقت الإنجاز يجب أن يكون رقمًا موجبًا" };

  const supabase = await createClient();
  // priority isn't editable after creation - changing it would need to
  // re-check the one-active-policy-per-priority index against a different
  // row, which is more churn than this form needs to support
  const { error } = await supabase
    .from("sla_policies")
    .update({
      name,
      response_minutes: responseMinutes,
      resolution_minutes: resolutionMinutes,
    })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث السياسة" };

  revalidatePath("/dashboard/sla-policies");
  return {};
}

export async function toggleSlaPolicyActive(id: string, isActive: boolean): Promise<SlaFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageSlaPolicies(profile)) {
    return { error: "غير مصرح لك بإدارة سياسات SLA" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sla_policies").update({ is_active: isActive }).eq("id", id);

  if (error) {
    return { error: error.message || "تعذر التحديث (قد توجد سياسة نشطة أخرى لهذه الأولوية)" };
  }

  revalidatePath("/dashboard/sla-policies");
  return {};
}

export async function deleteSlaPolicy(id: string): Promise<SlaFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageSlaPolicies(profile)) {
    return { error: "غير مصرح لك بإدارة سياسات SLA" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sla_policies").delete().eq("id", id);

  if (error) return { error: "تعذر حذف السياسة" };

  revalidatePath("/dashboard/sla-policies");
  return {};
}
