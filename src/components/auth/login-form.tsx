"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signUpWithEmail, type SignInState, type SignUpState } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { createClient } from "@/lib/supabase/client";

const initialState: SignInState = {};
const initialSignUpState: SignUpState = {};

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
function getResetErrorSnapshot() {
  return new URLSearchParams(window.location.search).get("error") === "reset";
}
function getErrorServerSnapshot() {
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

type GoogleMode = "join" | "create";

export function LoginForm({ orgLogoUrl }: { orgLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithEmail, initialSignUpState);
  const [googlePending, setGooglePending] = useState(false);
  const [googleMode, setGoogleMode] = useState<GoogleMode>("join");
  const [newOrgName, setNewOrgName] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [adminRequestPending, setAdminRequestPending] = useState(false);
  const [adminRequestSent, setAdminRequestSent] = useState(false);
  // Avoids useSearchParams(), which would force this otherwise-static page
  // into a Suspense boundary just to show one conditional banner.
  const googleError = useSyncExternalStore(subscribeNever, getGoogleErrorSnapshot, getErrorServerSnapshot);
  const resetLinkError = useSyncExternalStore(subscribeNever, getResetErrorSnapshot, getErrorServerSnapshot);

  const creatingWithoutName = googleMode === "create" && !newOrgName.trim();

  function openForgotPassword() {
    setResetEmail(emailRef.current?.value ?? "");
    setResetError(null);
    setResetSent(false);
    setAdminRequestSent(false);
    setMode("forgot");
  }

  async function handleForgotPassword() {
    if (!resetEmail.trim()) {
      setResetError("أدخل بريدك الإلكتروني");
      return;
    }
    setResetPending(true);
    setResetError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setResetPending(false);
    if (error) {
      setResetError("تعذّر إرسال الرابط، حاول مرة أخرى");
      return;
    }
    setResetSent(true);
  }

  /**
   * Fallback path for when outbound email doesn't reach real employees
   * (Resend sandbox mode currently only delivers to its own account owner) -
   * notifies the org's super_admin(s) in-app instead (see
   * request_password_reset in supabase/password_reset_request_notify.sql),
   * who can then set a new password directly from the employee's profile
   * page. Always reports success either way, same anti-enumeration shape as
   * the email path above.
   */
  async function handleRequestAdminReset() {
    if (!resetEmail.trim()) {
      setResetError("أدخل بريدك الإلكتروني");
      return;
    }
    setAdminRequestPending(true);
    setResetError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("request_password_reset", {
      p_email: resetEmail.trim(),
    });
    setAdminRequestPending(false);
    if (error) {
      setResetError("تعذّر إرسال الطلب، حاول مرة أخرى");
      return;
    }
    setAdminRequestSent(true);
  }

  async function handleGoogle() {
    if (creatingWithoutName) return;
    setGooglePending(true);
    const supabase = createClient();
    // new_org rides through Google's OAuth roundtrip inside redirectTo
    // itself (Supabase preserves any extra query params on it) and comes
    // back on /auth/callback, which calls claim_new_organization() with it -
    // see saas_multi_tenant_v3.sql for why this is safe even if replayed.
    const redirectTo =
      googleMode === "create"
        ? `${window.location.origin}/auth/callback?new_org=${encodeURIComponent(newOrgName.trim())}`
        : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
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
        {mode === "login" ? (
          <>
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
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-bold text-accent-600 hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
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
              {resetLinkError && (
                <p className="text-sm text-red-600" role="alert">
                  انتهت صلاحية رابط إعادة التعيين، اطلب رابطًا جديدًا
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

            <div className="mt-4 flex rounded-[10px] border border-border bg-background p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setGoogleMode("join")}
                className={`flex-1 rounded-[7px] py-1.5 transition-colors ${
                  googleMode === "join" ? "bg-surface text-foreground shadow-sm" : "text-muted"
                }`}
              >
                الانضمام إلى مؤسستي
              </button>
              <button
                type="button"
                onClick={() => setGoogleMode("create")}
                className={`flex-1 rounded-[7px] py-1.5 transition-colors ${
                  googleMode === "create" ? "bg-surface text-foreground shadow-sm" : "text-muted"
                }`}
              >
                إنشاء مؤسسة جديدة
              </button>
            </div>

            {googleMode === "create" && (
              <input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="اسم المؤسسة الجديدة"
                className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googlePending || creatingWithoutName}
              className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60"
            >
              <GoogleLogo />
              {googlePending ? "جارٍ التحويل..." : "المتابعة عبر Google"}
            </button>

            {googleMode === "create" && (
              <>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-faint">أو</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {signUpState?.needsConfirmation ? (
                  <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-center text-sm font-bold text-green-700">
                    تحقق من بريدك الإلكتروني لتأكيد الحساب وإكمال إنشاء المؤسسة.
                  </p>
                ) : (
                  <form action={signUpAction} className="mt-3 space-y-2.5">
                    <input type="hidden" name="org_name" value={newOrgName} />
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="البريد الإلكتروني"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                    />
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="كلمة المرور (8 أحرف على الأقل)"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                    />
                    {signUpState?.error && (
                      <p className="text-sm text-red-600" role="alert">
                        {signUpState.error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={signUpPending || creatingWithoutName}
                      className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60"
                    >
                      {signUpPending ? "جارٍ الإنشاء..." : "إنشاء الحساب بالبريد وكلمة المرور"}
                    </button>
                  </form>
                )}
              </>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-faint">
              {googleMode === "create"
                ? "ستُصبح المدير العام لمؤسسة جديدة فور تسجيل الدخول"
                : "حساب Google غير مسجَّل سابقًا ينضم كموظف بانتظار موافقة المدير العام"}
            </p>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور
            </p>

            {resetSent ? (
              <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-bold text-green-700">
                تم إرسال الرابط! تحقق من بريدك الإلكتروني.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-foreground">
                    البريد الإلكتروني
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                  />
                </div>

                {resetError && (
                  <p className="text-sm text-red-600" role="alert">
                    {resetError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetPending}
                  className="w-full rounded-[10px] bg-accent-500 px-3 py-2.5 text-sm font-extrabold text-white transition-all hover:scale-[1.02] hover:bg-accent-600 disabled:opacity-60 disabled:hover:scale-100"
                >
                  {resetPending ? "جارٍ الإرسال..." : "إرسال رابط إعادة التعيين"}
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-faint">أو</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {adminRequestSent ? (
              <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-center text-sm font-bold text-green-700">
                تم إرسال طلبك لمديرك، سيتواصل معك لتعيين كلمة مرور جديدة.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestAdminReset}
                disabled={adminRequestPending}
                className="mt-3 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60"
              >
                {adminRequestPending
                  ? "جارٍ الإرسال..."
                  : "أرسل طلبًا لمديرك ليعيّن لك كلمة مرور جديدة"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-5 w-full text-center text-sm font-bold text-accent-600 hover:underline"
            >
              رجوع لتسجيل الدخول
            </button>
          </>
        )}
      </div>
    </main>
  );
}
