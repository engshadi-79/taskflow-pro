import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ChartIcon } from "@/components/shared/icons";
import { LOAD_STATUS_LABEL, type WorkloadRow } from "@/lib/types/workload";

const STATUS_BADGE: Record<string, string> = {
  low: "bg-green-50 text-green-600",
  normal: "bg-accent-50 text-accent-700",
  high: "bg-orange-50 text-orange-600",
  critical: "bg-brand-red-50 text-brand-red-500",
};

const BAR_TONE: Record<string, string> = {
  low: "bg-green-500",
  normal: "bg-accent-500",
  high: "bg-orange-500",
  critical: "bg-brand-red-500",
};

export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: Promise<{ department_id?: string; project_id?: string; due_before?: string }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  // a department_manager only sees their own department regardless of what
  // the query string says - RLS on public.users inside employee_workload()
  // would filter it anyway, but this avoids the filter UI silently doing
  // nothing for them
  const departmentId =
    profile.role === "department_manager" ? profile.department_id : params.department_id || null;
  const projectId = params.project_id || null;
  const dueBefore = params.due_before || null;

  const supabase = await createClient();

  const [{ data: workload }, { data: departments }, { data: projects }] = await Promise.all([
    supabase.rpc("employee_workload", {
      p_department_id: departmentId,
      p_project_id: projectId,
      p_due_before: dueBefore,
    }),
    profile.role === "super_admin"
      ? supabase.from("departments").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const rows = (workload as WorkloadRow[] | null) ?? [];
  const critical = rows.filter((r) => r.load_status === "critical").length;

  return (
    <div>
      <PageHeader
        title="الحمل الوظيفي"
        subtitle="توزيع المهام على الفريق، وليس مجرد عدّها"
        variant="navy"
        icon={<ChartIcon className="h-6 w-6" />}
        count={`${critical} حالة حرجة`}
      />

      <form
        method="get"
        className="mb-4.5 flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4"
      >
        {profile.role === "super_admin" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">القسم</span>
            <select
              name="department_id"
              defaultValue={departmentId ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
            >
              <option value="">كل الأقسام</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المشروع</span>
          <select
            name="project_id"
            defaultValue={projectId ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            <option value="">كل المشاريع</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">مهام مستحقة قبل</span>
          <input
            type="date"
            name="due_before"
            defaultValue={dueBefore ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          />
        </label>
        <button
          type="submit"
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600"
        >
          تصفية
        </button>
      </form>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-1.5 py-4 text-start">الموظف</th>
              <th className="px-1.5 py-4 text-start">إجمالي المهام</th>
              <th className="px-1.5 py-4 text-start">عاجلة</th>
              <th className="px-1.5 py-4 text-start">متأخرة</th>
              <th className="px-1.5 py-4 text-start">قيد التنفيذ</th>
              <th className="px-1.5 py-4 text-start">الحمل</th>
              <th className="px-1.5 py-4 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-t border-border transition-colors hover:bg-background">
                <td className="px-1.5 py-4 font-medium text-foreground">{row.full_name}</td>
                <td className="px-1.5 py-4 text-muted">{row.open_count}</td>
                <td className={`px-1.5 py-4 ${row.urgent_count > 0 ? "font-semibold text-brand-red-500" : "text-muted"}`}>
                  {row.urgent_count}
                </td>
                <td className={`px-1.5 py-4 ${row.overdue_count > 0 ? "font-semibold text-brand-red-500" : "text-muted"}`}>
                  {row.overdue_count}
                </td>
                <td className="px-1.5 py-4 text-muted">{row.in_progress_count}</td>
                <td className="px-1.5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-background">
                      <div
                        className={`h-full rounded-full ${BAR_TONE[row.load_status]}`}
                        style={{ width: `${row.load_percent}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-muted">{row.load_percent}٪</span>
                  </div>
                </td>
                <td className="px-1.5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[row.load_status]}`}
                  >
                    {LOAD_STATUS_LABEL[row.load_status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
                      <ChartIcon className="h-5 w-5" />
                    </span>
                    <p className="text-[13px] text-muted">لا يوجد موظفون مطابقون</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
