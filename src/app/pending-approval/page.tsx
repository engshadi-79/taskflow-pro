import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { signOut } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { ClockIcon } from "@/components/shared/icons";

export default async function PendingApprovalPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  if (profile.is_active) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4">
      <AnimatedBackground intensity="hero" />
      <div
        aria-hidden
        className="animate-blob-1 absolute -top-24 -start-24 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob-2 absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm rounded-[20px] border border-border bg-surface/90 p-8 text-center shadow-2xl backdrop-blur-md">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          <ClockIcon className="h-7 w-7" />
        </span>

        <h1 className="font-display text-xl font-black text-foreground">
          حسابك بانتظار الموافقة
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          مرحبًا {profile.full_name.split(" ")[0]}، تم استلام تسجيلك عبر
          Google. سيراجع المدير العام طلبك، وستتمكن من الدخول فور الموافقة.
        </p>

        <div className="mt-5 rounded-[12px] bg-background px-4 py-3 text-start text-[13px] text-muted">
          <div>
            <span className="font-bold text-foreground">الاسم: </span>
            {profile.full_name}
          </div>
          <div className="mt-1">
            <span className="font-bold text-foreground">البريد: </span>
            {profile.email}
          </div>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-[10px] border border-border px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background"
          >
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
