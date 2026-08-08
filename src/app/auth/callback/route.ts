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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=google`);
}
