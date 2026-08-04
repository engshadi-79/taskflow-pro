import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import type { Notification } from "@/lib/types/notification";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Notification[]>();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[22px] text-foreground">الإشعارات</h1>
      <NotificationsList notifications={notifications ?? []} />
    </div>
  );
}
