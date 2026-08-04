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
