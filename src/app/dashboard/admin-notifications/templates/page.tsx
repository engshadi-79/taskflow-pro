import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { NoteIcon } from "@/components/shared/icons";
import { AdminNotificationTemplatesManager } from "@/components/dashboard/admin-notification-templates-manager";

export default async function AdminNotificationTemplatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin" && profile.role !== "department_manager") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_notification_templates")
    .select("id, name, title, message, type, priority, created_by")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-4.5">
      <Link href="/dashboard/admin-notifications/new" className="text-[12.5px] font-bold text-accent-600 hover:underline">
        ← العودة لإنشاء إشعار
      </Link>

      <PageHeader
        title="قوالب الإشعارات الإدارية"
        subtitle="نصوص جاهزة يمكن إعادة استخدامها عند إنشاء إشعار جديد"
        variant="navy"
        icon={<NoteIcon className="h-6 w-6" />}
      />

      <AdminNotificationTemplatesManager
        templates={data ?? []}
        currentUserId={profile.id}
        canManageAll={profile.role === "super_admin"}
      />
    </div>
  );
}
