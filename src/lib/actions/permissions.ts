"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { logActivity } from "@/lib/foundation/audit";

export type PermissionFormState = { error?: string };

const EDITABLE_ROLES = ["department_manager", "employee"];

export async function toggleRolePermission(
  role: string,
  permissionKey: string,
  enabled: boolean,
  scope: string
): Promise<PermissionFormState> {
  const profile = await getCurrentProfile();
  // Hard-coded role check, deliberately not can.manageOrganization() -
  // this action IS the system that grants/revokes what can.*() sees, so it
  // must never depend on itself. Gating it with a revocable permission
  // would risk a super_admin locking themselves out of the one page that
  // could undo the mistake.
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتعديل مصفوفة الصلاحيات" };
  }
  if (!EDITABLE_ROLES.includes(role)) {
    return { error: "لا يمكن تعديل صلاحيات المدير العام" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_role_permission", {
    p_role: role,
    p_permission_key: permissionKey,
    p_enabled: enabled,
    p_scope: scope,
  });

  if (error) return { error: error.message || "تعذر تحديث الصلاحية" };

  await logActivity(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    actionType: enabled ? "permission_granted" : "permission_revoked",
    entityType: "role_permission",
    description: `${enabled ? "منح" : "سحب"} صلاحية "${permissionKey}" لدور "${role}"`,
  });

  revalidatePath("/dashboard/settings/permissions");
  revalidatePath("/dashboard", "layout");
  return {};
}
