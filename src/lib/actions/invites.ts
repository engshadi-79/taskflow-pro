"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { logActivity } from "@/lib/foundation/audit";
import { getAppUrl } from "@/lib/email/resend";

async function requireOrgManager() {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageOrganization(profile)) return null;
  return profile;
}

export type CreateInviteState = { error?: string; link?: string };

export async function createInvite(_prevState: CreateInviteState, formData: FormData): Promise<CreateInviteState> {
  const profile = await requireOrgManager();
  if (!profile) return { error: "غير مصرح لك بإنشاء دعوات" };

  const role = formData.get("role") as string;
  const departmentId = (formData.get("department_id") as string) || null;
  const maxUsesRaw = (formData.get("max_uses") as string)?.trim();
  const expiresInDays = Number(formData.get("expires_in_days"));

  if (role !== "employee" && role !== "department_manager") {
    return { error: "اختر دورًا صالحًا" };
  }
  if (!expiresInDays || expiresInDays <= 0) {
    return { error: "حدد مدة صلاحية أكبر من صفر" };
  }
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return { error: "عدد الاستخدامات يجب أن يكون رقمًا صحيحًا أكبر من صفر" };
  }

  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: profile.organization_id,
      code,
      created_by: profile.id,
      role,
      department_id: departmentId,
      max_uses: maxUses,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !invite) return { error: "تعذّر إنشاء رابط الدعوة" };

  await logActivity(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    actionType: "invite_created",
    entityType: "organization_invite",
    entityId: invite.id,
    description: `أنشأ ${profile.full_name} رابط دعوة بدور ${role === "employee" ? "موظف" : "مدير قسم"}`,
  });

  revalidatePath("/dashboard/employees");
  return { link: `${getAppUrl()}/invite/${code}` };
}

export type RevokeInviteState = { error?: string };

export async function revokeInvite(_prevState: RevokeInviteState, formData: FormData): Promise<RevokeInviteState> {
  const profile = await requireOrgManager();
  if (!profile) return { error: "غير مصرح لك بإلغاء دعوات" };

  const inviteId = formData.get("invite_id") as string;
  if (!inviteId) return { error: "بيانات غير صالحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) return { error: "تعذّر إلغاء الدعوة" };

  revalidatePath("/dashboard/employees");
  return {};
}
