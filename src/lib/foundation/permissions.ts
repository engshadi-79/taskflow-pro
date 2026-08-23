import type { Profile } from "@/lib/types/roles";
import { PermissionError } from "./errors";

function hasPermission(profile: Profile, key: string): boolean {
  return profile.permissionKeys.includes(key);
}

/**
 * Named capability checks - a facade so call sites ask "can this profile
 * do X" instead of checking a permission key (or, before P02, a hard-coded
 * role) inline everywhere. Backed by the database-driven permission
 * matrix now (public.role_permissions + public.user_permission_overrides,
 * resolved into profile.permissionKeys by getCurrentProfile() via
 * get_user_permissions()) - a Super Admin can regrant/revoke any of these
 * from /dashboard/settings/permissions without a code change or
 * deployment, which is the whole point of naming capabilities here
 * instead of comparing roles.
 */
export const can = {
  manageOrganization: (profile: Profile) => hasPermission(profile, "organization.manage"),
  sendAdminNotification: (profile: Profile) => hasPermission(profile, "notifications.send"),
  sendAdminNotificationOrgWide: (profile: Profile) => hasPermission(profile, "notifications.send_org_wide"),
  manageSlaPolicies: (profile: Profile) => hasPermission(profile, "sla.manage"),
  manageWorkflowTemplates: (profile: Profile) => hasPermission(profile, "workflows.manage"),
  manageAutomationRules: (profile: Profile) => hasPermission(profile, "automation.manage"),
  manageDepartment: (profile: Profile) => hasPermission(profile, "employees.update"),
  buildReports: (profile: Profile) => hasPermission(profile, "reports.build"),
};

// "requests.approve" exists in the permission catalogue and is seeded for
// super_admin/department_manager (matching can_act_on_workflow_request()'s
// approver types), but deliberately has no `can.*` wrapper yet: that SQL
// function's authorization is per-request (a specific_user approver step
// grants access without this general permission at all), strictly more
// fine-grained than an org-wide flag can express - gating
// actOnWorkflowRequest() with it here would incorrectly block a
// specifically assigned approver who lacks the general permission. It's
// left as data for a future Approval Center (P07) to combine with the
// per-request check when it needs "everything I could act on" listings.

/** Throws PermissionError instead of returning a boolean - use inside a
 * Server Action already wrapped in a try/catch that calls
 * toActionError(), when an early `if (!can.x(profile)) return { error }`
 * would read awkwardly mid validation chain. */
export function assertCan(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}
