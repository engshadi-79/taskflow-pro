"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformOwner } from "@/lib/actions/guards";
import type { PlanType } from "@/lib/types/organization";

export type UpdateOrgState = { error?: string; success?: boolean };

/**
 * Owner-only edit of another organization's own row - regular org settings
 * (organization-settings.ts) only ever update the caller's own org via RLS,
 * so this goes through the admin client + requirePlatformOwner instead, same
 * shape as getAllOrganizationsForOwner in lib/data/organization.ts.
 */
export async function updateOrganizationAsOwner(
  _prevState: UpdateOrgState,
  formData: FormData
): Promise<UpdateOrgState> {
  try {
    await requirePlatformOwner();
  } catch {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const orgId = formData.get("org_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const planType = formData.get("plan_type") as PlanType;

  if (!orgId || !name) {
    return { error: "اسم المؤسسة مطلوب" };
  }
  if (planType !== "free" && planType !== "paid") {
    return { error: "خطة غير صالحة" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, plan_type: planType })
    .eq("id", orgId);

  if (error) return { error: "تعذّر تحديث المؤسسة" };

  revalidatePath("/dashboard/platform");
  return { success: true };
}

export type DeleteOrgState = { error?: string };

/**
 * Deletes the organization row itself; every dependent table (departments,
 * users, tasks, projects, ...) references organizations(id) on delete
 * cascade (schema.sql), so this one delete removes that org's entire data -
 * irreversible. Requires typing the organization's own current name back
 * exactly as a deliberate confirmation step, on top of requirePlatformOwner,
 * since a bare confirm() dialog is too easy to click through by habit for
 * something this destructive.
 */
export async function deleteOrganizationAsOwner(
  _prevState: DeleteOrgState,
  formData: FormData
): Promise<DeleteOrgState> {
  try {
    await requirePlatformOwner();
  } catch {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const orgId = formData.get("org_id") as string;
  const actualName = (formData.get("actual_name") as string)?.trim();
  const confirmName = (formData.get("confirm_name") as string)?.trim();

  if (!orgId || !actualName) {
    return { error: "بيانات غير صالحة" };
  }
  if (confirmName !== actualName) {
    return { error: "الاسم المكتوب لا يطابق اسم المؤسسة - لم يتم الحذف" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("organizations").delete().eq("id", orgId);

  if (error) return { error: "تعذّر حذف المؤسسة" };

  revalidatePath("/dashboard/platform");
  return {};
}

export type ApprovePlanUpgradeState = { error?: string; success?: boolean };

/**
 * Flips the org to paid AND resolves the request it came from, in one
 * click - the owner reviews the submitted payment_method/payment_reference
 * (rendered in platform-organizations-manager.tsx) out of band before
 * clicking this, there is no automated verification of the transfer itself.
 */
export async function approvePlanUpgrade(
  _prevState: ApprovePlanUpgradeState,
  formData: FormData
): Promise<ApprovePlanUpgradeState> {
  try {
    await requirePlatformOwner();
  } catch {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const orgId = formData.get("organization_id") as string;
  const requestId = formData.get("request_id") as string;
  if (!orgId || !requestId) return { error: "بيانات غير صالحة" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("organizations").update({ plan_type: "paid" }).eq("id", orgId);
  if (error) return { error: "تعذّر تفعيل الخطة المدفوعة" };

  await supabase.from("plan_upgrade_requests").update({ status: "resolved" }).eq("id", requestId);

  revalidatePath("/dashboard/platform");
  return { success: true };
}
