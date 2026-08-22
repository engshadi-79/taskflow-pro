import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AlertIcon, NoteIcon } from "@/components/shared/icons";
import { AdminNotificationForm } from "@/components/dashboard/admin-notification-form";

export default async function NewAdminNotificationPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin" && profile.role !== "department_manager") redirect("/dashboard");

  const supabase = await createClient();
  const isDepartmentManager = profile.role === "department_manager";

  // RLS on users already scopes a department_manager's own query to their
  // own department's employees - no extra filtering needed here
  const [{ data: employeesRaw }, { data: departmentsRaw }, { data: ownDepartment }, { data: templatesRaw }] = await Promise.all([
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
    isDepartmentManager
      ? Promise.resolve({ data: [] })
      : supabase.from("departments").select("id, name").order("name"),
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("admin_notification_templates")
      .select("id, name, title, message, type, priority")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4.5">
      <PageHeader
        title="إشعار إداري جديد"
        subtitle="اكتب الرسالة، حدّد المستلمين، ثم أرسلها الآن أو جدولها"
        variant="navy"
        icon={<AlertIcon className="h-6 w-6" />}
      >
        <Link
          href="/dashboard/admin-notifications/templates"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
        >
          <NoteIcon className="h-4 w-4" />
          إدارة القوالب
        </Link>
      </PageHeader>

      <AdminNotificationForm
        employees={(employeesRaw ?? []).filter((e) => e.id !== profile.id)}
        departments={departmentsRaw ?? []}
        templates={templatesRaw ?? []}
        isDepartmentManager={isDepartmentManager}
        ownDepartmentId={profile.department_id}
        ownDepartmentName={(ownDepartment as { name: string } | null)?.name}
      />
    </div>
  );
}
