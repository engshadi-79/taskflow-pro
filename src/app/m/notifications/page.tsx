import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileNotificationsList } from "@/components/mobile/mobile-notifications-list";
import type { Notification } from "@/lib/types/notification";

export default async function MobileNotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Notification[]>();

  return (
    <div>
      <MobileHeader title="الإشعارات" />
      <MobileNotificationsList notifications={notifications ?? []} />
    </div>
  );
}
