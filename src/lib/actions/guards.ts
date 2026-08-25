import { getCurrentProfile } from "@/lib/data/profile";
import type { Profile, Role } from "@/lib/types/roles";

// RLS is the real access-control boundary for regular table reads/writes.
// This guard exists for actions that use the service-role admin client
// (auth.admin.*), which bypasses RLS entirely and therefore needs its own
// role check before doing anything.
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile || !roles.includes(profile.role)) {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }

  return profile;
}

/**
 * Distinct from requireRole - "super_admin" is scoped per organization (any
 * client who self-signs-up to create a new org becomes super_admin of just
 * that one), so it can't gate a view across every organization on the
 * platform without leaking one client's existence/name to every other. This
 * checks the caller's email against a single owner address instead, kept in
 * an env var rather than hardcoded so it isn't baked into the public repo.
 */
export async function requirePlatformOwner(): Promise<Profile> {
  const profile = await getCurrentProfile();
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;

  if (!profile || !ownerEmail || profile.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }

  return profile;
}
