"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/guards";
import { sendEmail } from "@/lib/email/resend";

export type PlanUpgradeState = { error?: string; success?: boolean };

/**
 * No payment processor exists yet - this logs a real, auditable request
 * (visible to the org's own super_admin via plan_upgrade_requests RLS) and
 * best-effort emails SUPPORT_EMAIL via the same Resend helper P15 already
 * built, so the actual upgrade (flipping plan_type) stays a manual step
 * for now rather than blocking on building a full checkout flow.
 */
export async function requestPlanUpgrade(
  _prevState: PlanUpgradeState,
  formData: FormData
): Promise<PlanUpgradeState> {
  const profile = await requireRole(["super_admin"]);
  const note = (formData.get("note") as string)?.trim() || null;

  const paymentMethodRaw = (formData.get("payment_method") as string)?.trim() || null;
  let paymentMethod: "bank_transfer" | "binance" | null = null;
  let paymentReference: string | null = null;
  if (paymentMethodRaw) {
    if (paymentMethodRaw !== "bank_transfer" && paymentMethodRaw !== "binance") {
      return { error: "طريقة دفع غير صالحة" };
    }
    paymentReference = (formData.get("payment_reference") as string)?.trim() || null;
    if (!paymentReference) return { error: "الرجاء إدخال رقم/مرجع التحويل" };
    paymentMethod = paymentMethodRaw;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("plan_upgrade_requests").insert({
    organization_id: profile.organization_id,
    requested_by: profile.id,
    note,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
  });

  if (error) return { error: "تعذر إرسال طلب الترقية" };

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (supportEmail) {
    await sendEmail({
      to: supportEmail,
      subject: `طلب ترقية خطة — ${profile.full_name}`,
      html: `<p>طلب ترقية جديد من <b>${profile.full_name}</b> (${profile.email}).</p>${
        note ? `<p>ملاحظة: ${note}</p>` : ""
      }`,
    });
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
