import type { Profile } from "@/lib/types/roles";
import { PermissionError } from "./errors";

/**
 * Named capability checks over the current 3-role model
 * (super_admin/department_manager/employee) - a facade so call sites ask
 * "can this profile do X" instead of comparing `profile.role` inline
 * everywhere. P02 (Security & RBAC) replaces the bodies of these
 * functions with real permission-string/group lookups later without any
 * call site needing to change, since they only ever see the capability
 * name, never the role check itself.
 */
export const can = {
  manageOrganization: (profile: Profile) => profile.role === "super_admin",
  sendAdminNotification: (profile: Profile) => profile.role === "super_admin" || profile.role === "department_manager",
  sendAdminNotificationOrgWide: (profile: Profile) => profile.role === "super_admin",
  manageSlaPolicies: (profile: Profile) => profile.role === "super_admin",
  manageAutomationRules: (profile: Profile) => profile.role === "super_admin",
  approveWorkflowRequest: (profile: Profile) => profile.role === "super_admin" || profile.role === "department_manager",
  manageDepartment: (profile: Profile) => profile.role === "super_admin" || profile.role === "department_manager",
};

/** Throws PermissionError instead of returning a boolean - use inside a
 * Server Action already wrapped in a try/catch that calls
 * toActionError(), when an early `if (!can.x(profile)) return { error }`
 * would read awkwardly mid validation chain. */
export function assertCan(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}
