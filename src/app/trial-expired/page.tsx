import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { isTrialExpired, getConfiguredPaymentMethods } from "@/lib/plans";
import { signOut } from "@/lib/actions/auth";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { PlanBillingSection } from "@/components/dashboard/plan-billing-section";
import { ClockIcon } from "@/components/shared/icons";

export default async function TrialExpiredPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const organization = await getCurrentOrganization();
  // A stale bookmark, or a since-upgraded/still-fresh organization, should
  // just bounce back in rather than show an expiry screen that no longer
  // applies - mirrors pending-approval's own "already resolved" redirect.
  if (!organization || !isTrialExpired(organization)) redirect("/dashboard");

  let seatCount = 0;
  let hasPendingRequest = false;
  if (profile.role === "super_admin") {
    const supabase = await createClient();
    const [{ count }, { data: pendingRequest }] = await Promise.all([
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true),
      supabase
        .from("plan_upgrade_requests")
        .select("id")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    seatCount = count ?? 0;
    hasPendingRequest = !!pendingRequest;
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AnimatedBackground intensity="hero" />
      <div
        aria-hidden
        className="animate-blob-1 absolute -top-24 -start-24 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob-2 absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm space-y-4 text-center">
        <div className="rounded-[20px] border border-border bg-surface/90 p-8 shadow-2xl backdrop-blur-md">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <ClockIcon className="h-7 w-7" />
          </span>

          <h1 className="font-display text-xl font-black text-foreground">انتهت الفترة التجريبية</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {profile.role === "super_admin"
              ? "انتهت مدة الـ14 يومًا للخطة المجانية. رقّي إلى الخطة المدفوعة للمتابعة."
              : "انتهت الفترة التجريبية لمؤسستكم. تواصل مع المدير العام لترقية الاشتراك والمتابعة."}
          </p>

          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-[10px] border border-border px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>

        {profile.role === "super_admin" && (
          <div className="text-start">
            <PlanBillingSection
              organization={organization}
              seatCount={seatCount}
              hasPendingRequest={hasPendingRequest}
              paymentMethods={getConfiguredPaymentMethods()}
            />
          </div>
        )}
      </div>
    </main>
  );
}
