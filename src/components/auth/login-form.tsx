"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { createClient } from "@/lib/supabase/client";

const initialState: SignInState = {};

// Reading window.location.search directly during render would mismatch the
// server's HTML (which has no window), so this goes through
// useSyncExternalStore the same way theme-toggle.tsx reads client-only
// state: server/first-paint render the safe default, then sync for real.
function subscribeNever() {
  return () => {};
}
function getGoogleErrorSnapshot() {
  return new URLSearchParams(window.location.search).get("error") === "google";
}
function getGoogleErrorServerSnapshot() {
  return false;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.26a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function LoginForm({ orgLogoUrl }: { orgLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [googlePending, setGooglePending] = useState(false);
  // Avoids useSearchParams(), which would force this otherwise-static page
  // into a Suspense boundary just to show one conditional banner.
  const googleError = useSyncExternalStore(
    subscribeNever,
    getGoogleErrorSnapshot,
    getGoogleErrorServerSnapshot
  );

  async function handleGoogle() {
    setGooglePending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates away to Google immediately; an error
    // here means the request never left, so it's safe to reset the button.
    if (error) setGooglePending(false);
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4">
      <AnimatedBackground intensity="hero" />
      <div
        aria-hidden
        className="animate-blob-1 absolute -top-24 -start-24 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob-2 absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm rounded-[20px] border border-border bg-surface/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 flex items-center gap-2.5">
          {orgLogoUrl ? (
            <img src={orgLogoUrl} alt="" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground text-base text-surface">
              م
            </span>
          )}
          <span className="font-display text-xl font-black text-foreground">منجز</span>
        </div>
        <p className="mb-6 text-sm text-muted">سجّل الدخول للوصول إلى مهامك</p>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              كلمة المرور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[10px] bg-accent-500 px-3 py-2.5 text-sm font-extrabold text-white transition-all hover:scale-[1.02] hover:bg-accent-600 disabled:opacity-60 disabled:hover:scale-100"
          >
            {pending ? "جارٍ الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        {googleError && (
          <p className="mt-4 text-center text-sm text-red-600" role="alert">
            تعذّر الدخول عبر Google، حاول مرة أخرى
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-faint">أو</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googlePending}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60"
        >
          <GoogleLogo />
          {googlePending ? "جارٍ التحويل..." : "المتابعة عبر Google"}
        </button>

        <p className="mt-5 text-center text-xs leading-5 text-faint">
          حساب جديد عبر Google ينشئ مؤسسة جديدة تلقائيًا وتصبح مديرها العام
        </p>
      </div>
    </main>
  );
}
