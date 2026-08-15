import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization } from "@/lib/types/organization";

/** organizations_select RLS already scopes this to exactly the caller's
 * own org - no .eq() needed, there's only ever one visible row. */
export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").single<Organization>();
  return data;
}

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
