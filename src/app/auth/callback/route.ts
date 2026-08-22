import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google redirects the browser here with a one-time `code` after the user
 * approves consent - and so does Supabase's password-reset email link, since
 * both go through the same PKCE code-exchange mechanism. Route Handlers
 * (unlike Server Components) can freely set cookies, so this is the only
 * place in the app that can actually complete the exchange and persist the
 * resulting session. `next` picks where to land afterwards (defaults to the
 * OAuth case's /dashboard); the reset-password flow points it at
 * /auth/update-password instead.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const newOrgName = searchParams.get("new_org");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Keeps public.users.email in sync after an email-change confirmation
      // (see sync_own_email.sql); a harmless no-op for every other flow
      // (OAuth sign-in, password reset) since the address never changed.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        await supabase.rpc("sync_own_email", { p_email: user.email });
      }
      if (newOrgName) {
        // Best-effort: claim_new_organization() (see saas_multi_tenant_v3.sql)
        // only ever acts when the just-signed-in account is still a pending
        // self-signup - a replayed/stale link or an existing account with
        // this param on it is a safe no-op, not an escalation.
        await supabase.rpc("claim_new_organization", { p_org_name: newOrgName });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const isResetFlow = next.startsWith("/auth/update-password");
  return NextResponse.redirect(`${origin}/login?error=${isResetFlow ? "reset" : "google"}`);
}
