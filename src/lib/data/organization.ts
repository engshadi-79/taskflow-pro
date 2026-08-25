import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformOwner } from "@/lib/actions/guards";
import type { Organization, PlanType } from "@/lib/types/organization";

/** organizations_select RLS already scopes this to exactly the caller's
 * own org - no .eq() needed, there's only ever one visible row.
 * cache()'d for the same reason as getCurrentProfile - dedupes repeat
 * calls within one request instead of re-querying per caller. */
export const getCurrentOrganization = cache(async (): Promise<Organization | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").single<Organization>();
  return data;
});

/**
 * Pre-login branding only (name + logo) - the /login page has no
 * authenticated user yet, so current_org_id() is null and
 * organizations_select RLS would return zero rows for it. Neither field is
 * sensitive (the logo bucket is already public-read), so the service-role
 * client is safe to use here specifically.
 *
 * This app supports multiple organizations (Google self-signup creates a
 * new one per company), but /login is a single shared page with no way yet
 * to know which org a not-yet-authenticated visitor belongs to - this
 * returns the oldest org as "the" instance branding. Fine while there is
 * only one organization in practice; revisit (e.g. subdomain-based lookup)
 * if a second one starts actually using this deployment.
 */
export async function getPublicOrganizationBranding(): Promise<{ name: string; logo_url: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, logo_url")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  return data;
}

export type PlatformOrganizationRow = {
  id: string;
  name: string;
  plan_type: PlanType;
  created_at: string;
  member_count: number;
  pending_upgrade_request: boolean;
};

/**
 * Cross-tenant list, for the platform owner only (requirePlatformOwner) -
 * every regular read in this app goes through RLS scoped to the caller's
 * own organization, so seeing every organization at once needs the
 * service-role client and its own explicit gate, same shape as
 * getPublicOrganizationBranding's use of it above.
 */
export async function getAllOrganizationsForOwner(): Promise<PlatformOrganizationRow[] | { error: string }> {
  try {
    await requirePlatformOwner();
  } catch {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = createAdminClient();

  const [{ data: orgs, error: orgsError }, { data: users }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, plan_type, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("organization_id"),
    supabase.from("plan_upgrade_requests").select("organization_id").eq("status", "pending"),
  ]);

  if (orgsError || !orgs) return { error: "تعذّر تحميل قائمة المؤسسات" };

  const memberCounts = new Map<string, number>();
  for (const user of users ?? []) {
    memberCounts.set(user.organization_id, (memberCounts.get(user.organization_id) ?? 0) + 1);
  }
  const pendingOrgIds = new Set((pendingRequests ?? []).map((r) => r.organization_id));

  return orgs.map((org) => ({
    ...org,
    member_count: memberCounts.get(org.id) ?? 0,
    pending_upgrade_request: pendingOrgIds.has(org.id),
  }));
}
