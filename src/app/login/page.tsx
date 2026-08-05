"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

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
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground text-base text-surface">
            م
          </span>
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
      </div>
    </main>
  );
}
