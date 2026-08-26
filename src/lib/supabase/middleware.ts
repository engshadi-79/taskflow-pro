import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Must be getUser() here, not getSession() - getSession() only decodes
  // the JWT locally and returns a "user" for any access token whose own exp
  // claim hasn't passed yet, even if the underlying session was actually
  // invalidated server-side (e.g. a refresh-token rotation from signing in
  // again elsewhere). That mismatch caused a real production outage: this
  // check would see the stale token as valid and let /dashboard through,
  // dashboard/layout.tsx's getCurrentProfile() would then call the real,
  // network-verified getUser() itself, correctly find no session, and
  // redirect to /login - which this check would then bounce straight back
  // to /dashboard, since it still read the same stale token as valid.
  // ERR_TOO_MANY_REDIRECTS, forever, until the cookie was cleared by hand.
  // getUser() costs one extra network round trip per navigation, but
  // getCurrentProfile() already pays that same cost right after anyway, so
  // this doesn't add a new network dependency - it just makes the two
  // checks agree.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
