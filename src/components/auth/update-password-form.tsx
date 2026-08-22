"use client";

import { useActionState } from "react";
import { confirmPasswordReset, type ResetPasswordState } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";

const initialState: ResetPasswordState = {};

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(confirmPasswordReset, initialState);

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4">
      <AnimatedBackground intensity="hero" />

      <div className="relative w-full max-w-sm rounded-[20px] border border-border bg-surface/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground text-base text-surface">
            م
          </span>
          <span className="font-display text-xl font-black text-foreground">منجز</span>
        </div>
        <p className="mb-6 text-sm text-muted">اختر كلمة مرور جديدة لحسابك</p>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="new_password" className="mb-1.5 block text-sm font-medium text-foreground">
              كلمة المرور الجديدة
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-foreground">
              تأكيد كلمة المرور
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              autoComplete="new-password"
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
            {pending ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
          </button>
        </form>
      </div>
    </main>
  );
}
