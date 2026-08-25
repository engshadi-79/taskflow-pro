import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { SidebarShell } from "@/components/dashboard/sidebar-shell";
import { Topbar } from "@/components/dashboard/topbar";
import { AiAssistantPanel } from "@/components/dashboard/ai-assistant-panel";
import { ChatWidget } from "@/components/dashboard/chat-widget";
import { PresenceTracker } from "@/components/dashboard/presence-tracker";

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
  const [{ count: unreadCount }, { data: department }, { data: recentActivity }, organization] = await Promise.all([
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", false),
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null }),
    // capped at 30 to match RecentActivityButton's own panel limit, so the
    // badge count and the list it opens always agree
    supabase.from("activity_log").select("id").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(30),
    getCurrentOrganization(),
  ]);

  const isPlatformOwner =
    !!process.env.PLATFORM_OWNER_EMAIL &&
    profile.email?.toLowerCase() === process.env.PLATFORM_OWNER_EMAIL.toLowerCase();

  return (
    <SidebarShell role={profile.role} logoUrl={organization?.logo_url} isPlatformOwner={isPlatformOwner}>
      <Topbar
        userId={profile.id}
        fullName={profile.full_name}
        role={profile.role}
        jobTitle={profile.job_title}
        avatarUrl={profile.avatar_url}
        currentEmail={profile.email}
        unreadCount={unreadCount ?? 0}
        recentActivityCount={recentActivity?.length ?? 0}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
      <ChatWidget currentUserId={profile.id} />
      <AiAssistantPanel />
      <PresenceTracker
        organizationId={profile.organization_id}
        userId={profile.id}
        fullName={profile.full_name}
        role={profile.role}
        departmentName={(department as { name: string } | null)?.name ?? null}
        avatarUrl={profile.avatar_url}
      />
    </SidebarShell>
  );
}
