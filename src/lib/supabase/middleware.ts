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

  // Optimistic check only, per Next.js's own guidance (Proxy runs on every
  // navigation, including prefetches, and "is not intended for slow data
  // fetching" - only reading the session from the cookie, not calling out
  // to the Supabase Auth server). getSession() decodes the JWT locally
  // (no network round trip); getUser() re-validates it against Supabase's
  // servers on every single request, which was doubling navigation latency
  // for no security benefit - getCurrentProfile() (src/lib/data/profile.ts)
  // already calls the real, network-verified getUser() itself on every
  // page load, and RLS re-checks the JWT server-side on every query
  // regardless of what this redirect decided. This is a UX nicety, not the
  // security boundary.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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
