"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import type { AutomationAction, AutomationTrigger } from "@/lib/types/automation";

export type AutomationFormState = { error?: string };

export async function createAutomationRule(
  _prevState: AutomationFormState,
  formData: FormData
): Promise<AutomationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageAutomationRules(profile)) {
    return { error: "غير مصرح لك بإدارة الأتمتة" };
  }

  const name = (formData.get("name") as string)?.trim();
  const triggerEvent = formData.get("trigger_event") as AutomationTrigger;
  const actionType = formData.get("action_type") as AutomationAction;
  const conditionPriority = (formData.get("condition_priority") as string) || "";
  const paramUserId = (formData.get("param_user_id") as string) || "";
  const paramStatus = (formData.get("param_status") as string) || "";
  const paramPriority = (formData.get("param_priority") as string) || "";
  const paramTitle = (formData.get("param_title") as string)?.trim() || "";

  if (!name) return { error: "اسم القاعدة مطلوب" };

  const conditions: Record<string, string> = {};
  if (conditionPriority) conditions.priority = conditionPriority;

  const actionParams: Record<string, string> = {};
  if (actionType === "notify_specific_user" || actionType === "reassign") {
    if (!paramUserId) return { error: "اختر الشخص المستهدف بهذا الإجراء" };
    actionParams.user_id = paramUserId;
  }
  if (actionType === "change_status") {
    if (!paramStatus) return { error: "اختر الحالة الجديدة" };
    actionParams.status = paramStatus;
  }
  if (actionType === "change_priority") {
    if (!paramPriority) return { error: "اختر الأولوية الجديدة" };
    actionParams.priority = paramPriority;
  }
  if (actionType === "create_followup_task") {
    if (paramTitle) actionParams.title = paramTitle;
    if (paramUserId) actionParams.assigned_to = paramUserId;
    if (paramPriority) actionParams.priority = paramPriority;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").insert({
    organization_id: profile.organization_id,
    name,
    trigger_event: triggerEvent,
    conditions: Object.keys(conditions).length ? conditions : null,
    action_type: actionType,
    action_params: Object.keys(actionParams).length ? actionParams : null,
  });

  if (error) return { error: "تعذر إنشاء القاعدة" };

  revalidatePath("/dashboard/automation-rules");
  return {};
}

export async function toggleAutomationRuleActive(id: string, isActive: boolean): Promise<AutomationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageAutomationRules(profile)) {
    return { error: "غير مصرح لك بإدارة الأتمتة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").update({ is_active: isActive }).eq("id", id);

  revalidatePath("/dashboard/automation-rules");
  return error ? { error: "تعذر التحديث" } : {};
}

export async function deleteAutomationRule(id: string): Promise<AutomationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageAutomationRules(profile)) {
    return { error: "غير مصرح لك بإدارة الأتمتة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);

  revalidatePath("/dashboard/automation-rules");
  return error ? { error: "تعذر حذف القاعدة" } : {};
}

/**
 * Instantiates a template into a real, editable rule via
 * use_automation_rule_template() - a SECURITY DEFINER function that re-checks
 * super_admin + re-derives the org itself, same as every other
 * privilege-sensitive RPC in this project. The client-side can.manageAutomationRules
 * check here is just a fast UI guard, not the real authorization boundary.
 */
export async function applyAutomationRuleTemplate(templateId: string, name?: string): Promise<AutomationFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageAutomationRules(profile)) {
    return { error: "غير مصرح لك بإدارة الأتمتة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("use_automation_rule_template", {
    p_template_id: templateId,
    p_name: name || null,
  });

  revalidatePath("/dashboard/automation-rules");
  return error ? { error: "تعذر استخدام القالب" } : {};
}
