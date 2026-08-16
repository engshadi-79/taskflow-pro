import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google redirects the browser here with a one-time `code` after the user
 * approves consent. Route Handlers (unlike Server Components) can freely set
 * cookies, so this is the only place in the app that can actually complete
 * the OAuth exchange and persist the resulting session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const newOrgName = searchParams.get("new_org");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (newOrgName) {
        // Best-effort: claim_new_organization() (see saas_multi_tenant_v3.sql)
        // only ever acts when the just-signed-in account is still a pending
        // self-signup - a replayed/stale link or an existing account with
        // this param on it is a safe no-op, not an escalation.
        await supabase.rpc("claim_new_organization", { p_org_name: newOrgName });
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=google`);
}
