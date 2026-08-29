import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/roles";

/**
 * The mobile app (Expo, no cookie jar) can't use the cookie-based SSR client
 * (`@/lib/supabase/server`) that every dashboard route relies on for
 * getCurrentProfile(). This is the mobile equivalent: given the user's own
 * Supabase access token (the same one the mobile Supabase client already
 * holds after login), build an anon-key client that carries that token as
 * its Authorization header, so PostgREST/RLS evaluate auth.uid() exactly as
 * it would for a cookie session - no service-role, no RLS bypass.
 */
export async function getProfileFromBearerToken(
  token: string
): Promise<{ supabase: SupabaseClient; profile: Profile } | null> {
  const supabase = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;

  const [{ data: profile }, { data: permissionKeys }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, organization_id, full_name, email, phone, role, department_id, job_title, avatar_url, is_active, created_at, dashboard_shortcuts"
      )
      .eq("id", user.id)
      .single<Omit<Profile, "permissionKeys">>(),
    supabase.rpc("get_user_permissions", { p_user_id: user.id }),
  ]);
  if (!profile) return null;

  return { supabase, profile: { ...profile, permissionKeys: permissionKeys ?? [] } };
}

/** Extracts the token from `Authorization: Bearer <token>`, or null if absent/malformed. */
export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
