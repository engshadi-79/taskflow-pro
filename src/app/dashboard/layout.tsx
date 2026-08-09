import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { SidebarShell } from "@/components/dashboard/sidebar-shell";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  // A self-signed-up Google account lands inactive until a super_admin
  // approves it (see supabase/google_signup.sql). This is UI routing only -
  // the real enforcement is current_org_id() resolving to NULL for an
  // inactive user, which RLS relies on throughout rls.sql.
  if (!profile.is_active) {
    redirect("/pending-approval");
  }

  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  return (
    <SidebarShell role={profile.role}>
      <Topbar
        userId={profile.id}
        fullName={profile.full_name}
        role={profile.role}
        jobTitle={profile.job_title}
        avatarUrl={profile.avatar_url}
        unreadCount={unreadCount ?? 0}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </SidebarShell>
  );
}
