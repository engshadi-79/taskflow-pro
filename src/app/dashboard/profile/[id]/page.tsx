import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditForm } from "@/components/dashboard/profile-edit-form";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { Avatar } from "@/components/shared/avatar";
import { computeEmployeeStats } from "@/lib/employee-stats";
import { CalendarIcon, MailIcon, PhoneIcon } from "@/components/shared/icons";
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from "@/lib/types/task";
import type { Profile, Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

function ContactRow({
  label,
  tint,
  icon,
  children,
}: {
  label: string;
  tint: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[10px] bg-background px-3 py-2">
      <span className="truncate text-[12.5px] font-medium text-foreground" dir="auto">
        {children}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-muted">
        {label}
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tint}`}>
          {icon}
        </span>
      </span>
    </div>
  );
}

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentProfile();

  if (!viewer) {
    redirect("/login");
  }

  const canView = viewer.role === "super_admin" || viewer.role === "department_manager";
  const canManage = viewer.role === "super_admin";

  if (id !== viewer.id && !canView) {
    redirect("/dashboard/profile");
  }

  const supabase = await createClient();

  const [{ data: employee }, { data: departments }, { data: tasks }] = await Promise.all([
    supabase
      .from("users")
      .select("id, organization_id, full_name, email, phone, role, department_id, job_title, avatar_url, is_active, created_at")
      .eq("id", id)
      .single<Profile>(),
    supabase.from("departments").select("id, name"),
    supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, created_at, updated_at, assigned_to")
      .eq("assigned_to", id)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<Task[]>(),
  ]);

  if (!employee) {
    notFound();
  }

  const departmentName = departments?.find((d) => d.id === employee.department_id)?.name;
  const stats = computeEmployeeStats(tasks ?? [], employee.id);
  const joinedLabel = new Date(employee.created_at).toLocaleDateString("ar", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-4.5">
      <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[320px_1fr]">
        <div className="rounded-[18px] border border-border bg-surface p-6.5 text-center">
          {id === viewer.id ? (
            <AvatarUpload avatarUrl={employee.avatar_url} fullName={employee.full_name} />
          ) : (
            <Avatar
              src={employee.avatar_url}
              name={employee.full_name}
              size={84}
              className="mx-auto mb-3.5 text-[28px]"
            />
          )}
          <h2 className="font-display text-[18px] text-foreground">{employee.full_name}</h2>
          <p className="mb-4.5 text-[13px] text-faint">
            {employee.job_title || ROLE_LABEL[employee.role]}
          </p>

          <div className="mb-5 flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-accent-50 px-3 py-1.5 text-[11.5px] font-extrabold text-accent-500">
              {ROLE_LABEL[employee.role]}
            </span>
            {departmentName && (
              <span className="rounded-full bg-accent-50 px-3 py-1.5 text-[11.5px] font-extrabold text-accent-500">
                {departmentName}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-extrabold ${
                employee.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"
              }`}
            >
              {employee.is_active ? "نشط" : "معطّل"}
            </span>
          </div>

          {/* labelled contact rows, as on the ACAS staff directory cards */}
          <div className="flex flex-col gap-2 border-t border-border pt-4 text-start">
            <ContactRow
              label="إيميل"
              tint="bg-brand-red-50 text-brand-red-500"
              icon={<MailIcon className="h-3.5 w-3.5" />}
            >
              {employee.email}
            </ContactRow>
            {employee.phone && (
              <ContactRow
                label="جوال"
                tint="bg-brand-blue-50 text-brand-blue-600"
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
              >
                {employee.phone}
              </ContactRow>
            )}
            <ContactRow
              label="انضم في"
              tint="bg-teal-50 text-teal-500"
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
            >
              {joinedLabel}
            </ContactRow>
          </div>
        </div>

        <div className="space-y-4.5">
          <div className="grid grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="font-display text-[26px] text-accent-500">{stats.taskCount}</div>
              <span className="text-[12.5px] text-faint">مهام حالية</span>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="font-display text-[26px] text-green-600">{stats.completionRate}٪</div>
              <span className="text-[12.5px] text-faint">نسبة الإنجاز</span>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="font-display text-[26px] text-orange-600">{stats.avgDays}</div>
              <span className="text-[12.5px] text-faint">متوسط أيام الإنجاز</span>
            </div>
          </div>

          <div className="rounded-[18px] border border-border bg-surface p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-[14.5px] font-extrabold text-foreground">مهام {employee.full_name.split(" ")[0]} الحالية</h4>
              <Link href="/dashboard/tasks" className="text-xs font-bold text-accent-500">
                عرض في صفحة المهام
              </Link>
            </div>
            {tasks && tasks.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-faint">
                  <tr>
                    <th className="px-1.5 py-2 text-start">المهمة</th>
                    <th className="px-1.5 py-2 text-start">الأولوية</th>
                    <th className="px-1.5 py-2 text-start">الموعد</th>
                    <th className="px-1.5 py-2 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-border">
                      <td className="px-1.5 py-3">
                        <Link
                          href={`/dashboard/tasks/${task.id}`}
                          className={`font-medium hover:text-accent-600 ${
                            task.status === "completed" ? "text-faint line-through" : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-1.5 py-3 text-muted">{PRIORITY_LABEL[task.priority]}</td>
                      <td className="px-1.5 py-3 text-muted">{task.due_date ?? "—"}</td>
                      <td className="px-1.5 py-3 text-muted">{STATUS_LABEL[task.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">لا توجد مهام حالية</p>
            )}
          </div>
        </div>
      </div>

      {canManage && employee.id !== viewer.id && (
        <ProfileEditForm employee={employee} departments={departments ?? []} />
      )}
    </div>
  );
}
