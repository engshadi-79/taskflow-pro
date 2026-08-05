import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import { PageHeader } from "@/components/shared/page-header";
import { BellIcon } from "@/components/shared/icons";
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
    <div>
      <PageHeader
        title="الإشعارات"
        subtitle="كل التنبيهات والتحديثات الخاصة بك"
        variant="violet"
        icon={<BellIcon className="h-6 w-6" />}
        count={`${notifications?.length ?? 0} إشعار`}
      />

      <NotificationsList notifications={notifications ?? []} />
    </div>
  );
}
