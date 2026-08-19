import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileTabBar } from "@/components/mobile/mobile-tab-bar";

// A dedicated manifest (start_url/scope "/m") lets this surface be packaged
// on its own - e.g. via PWABuilder - as an app that opens straight into the
// mobile UI, separate from the desktop dashboard's own manifest.json.
export const metadata: Metadata = {
  manifest: "/manifest-mobile.json",
};

/**
 * Auth gate mirrors src/app/dashboard/layout.tsx exactly - this is a
 * separate mobile-first UI surface (bottom tab bar instead of the sidebar),
 * not a separate app: same Supabase session, same RLS, same data layer.
 */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.is_active) {
    redirect("/pending-approval");
  }

  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      <MobileTabBar hasUnread={(unreadCount ?? 0) > 0} />
    </div>
  );
}
