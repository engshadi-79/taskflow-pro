"use client";

import { useActionState, useState } from "react";
import { signUpWithInvite, type SignUpState } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

const initialState: SignUpState = {};

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
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.26a12 12 0 0 0 0 10.78l4.01-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function InviteAcceptForm({
  code,
  organizationName,
  roleLabel,
  departmentName,
}: {
  code: string;
  organizationName: string;
  roleLabel: string;
  departmentName: string | null;
}) {
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithInvite, initialState);
  const [googlePending, setGooglePending] = useState(false);

  async function handleGoogle() {
    setGooglePending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?invite=${encodeURIComponent(code)}` },
    });
    if (error) setGooglePending(false);
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <span className="mb-3 flex h-9 w-9 items-center justify-center self-center rounded-[10px] bg-foreground text-base text-surface mx-auto">
          م
        </span>
        <h1 className="font-display text-lg font-black text-foreground">دعوة للانضمام إلى {organizationName}</h1>
        <p className="mt-2 text-sm text-muted">
          ستنضم بدور <b className="text-foreground">{roleLabel}</b>
          {departmentName && (
            <>
              {" "}
              في قسم <b className="text-foreground">{departmentName}</b>
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending}
        className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60"
      >
        <GoogleLogo />
        {googlePending ? "جارٍ التحويل..." : "المتابعة عبر Google"}
      </button>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-faint">أو</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {signUpState?.needsConfirmation ? (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-center text-sm font-bold text-green-700">
          تحقق من بريدك الإلكتروني لتأكيد الحساب والانضمام إلى {organizationName}.
        </p>
      ) : (
        <form action={signUpAction} className="mt-3 space-y-2.5">
          <input type="hidden" name="code" value={code} />
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
            disabled={signUpPending}
            className="w-full rounded-[10px] bg-accent-500 px-3 py-2.5 text-sm font-extrabold text-white transition-all hover:scale-[1.02] hover:bg-accent-600 disabled:opacity-60 disabled:hover:scale-100"
          >
            {signUpPending ? "جارٍ الإنشاء..." : "إنشاء الحساب بالبريد وكلمة المرور"}
          </button>
        </form>
      )}
    </div>
  );
}
