"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type DelegationFormState = { error?: string };

export async function createApprovalDelegation(
  _prevState: DelegationFormState,
  formData: FormData
): Promise<DelegationFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const delegateId = formData.get("delegate_id") as string;
  const startsAtRaw = (formData.get("starts_at") as string) || "";
  const endsAtRaw = formData.get("ends_at") as string;

  if (!delegateId) return { error: "اختر الشخص المفوَّض" };
  if (!endsAtRaw) return { error: "حدد تاريخ نهاية التفويض" };

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("approval_delegations").insert({
    organization_id: profile.organization_id,
    delegator_id: profile.id,
    delegate_id: delegateId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });

  if (error) {
    if (error.code === "23514") return { error: "لا يمكن تفويض نفسك" };
    return { error: error.message || "تعذر إنشاء التفويض" };
  }

  revalidatePath("/dashboard/approvals");
  return {};
}

export async function cancelApprovalDelegation(id: string): Promise<DelegationFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("approval_delegations").delete().eq("id", id);
  if (error) return { error: error.message || "تعذر إلغاء التفويض" };

  revalidatePath("/dashboard/approvals");
  return {};
}
