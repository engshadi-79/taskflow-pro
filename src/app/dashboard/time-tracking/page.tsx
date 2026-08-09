import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClockIcon } from "@/components/shared/icons";

type TimeReportRow = { user_id: string; full_name: string; total_seconds: number; entry_count: number };

function formatHours(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours}س ${minutes}د`;
}

export default async function TimeTrackingReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    department_id?: string;
    project_id?: string;
    user_id?: string;
    since?: string;
    until?: string;
  }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const departmentId =
    profile.role === "department_manager" ? profile.department_id : params.department_id || null;
  const projectId = params.project_id || null;
  const userId = params.user_id || null;
  const since = params.since || null;
  const until = params.until || null;

  const supabase = await createClient();

  const [{ data: report }, { data: departments }, { data: projects }, { data: employees }] =
    await Promise.all([
      supabase.rpc("time_report", {
        p_department_id: departmentId,
        p_project_id: projectId,
        p_user_id: userId,
        p_since: since,
        p_until: until,
      }),
      profile.role === "super_admin"
        ? supabase.from("departments").select("id, name").order("name")
        : Promise.resolve({ data: [] }),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("users").select("id, full_name").order("full_name"),
    ]);

  const rows = (report as TimeReportRow[] | null) ?? [];
  const totalSeconds = rows.reduce((sum, r) => sum + Number(r.total_seconds), 0);

  return (
    <div>
      <PageHeader
        title="سجلّ الوقت"
        subtitle="إجمالي الوقت المسجَّل لكل موظف"
        variant="teal"
        icon={<ClockIcon className="h-6 w-6" />}
        count={formatHours(totalSeconds)}
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
          <span className="mb-1.5 block text-sm font-medium text-foreground">الموظف</span>
          <select
            name="user_id"
            defaultValue={userId ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            <option value="">كل الموظفين</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </label>
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
          <span className="mb-1.5 block text-sm font-medium text-foreground">من تاريخ</span>
          <input
            type="date"
            name="since"
            defaultValue={since ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">إلى تاريخ</span>
          <input
            type="date"
            name="until"
            defaultValue={until ?? ""}
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
              <th className="px-1.5 py-4 text-start">عدد الجلسات</th>
              <th className="px-1.5 py-4 text-start">إجمالي الوقت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-t border-border">
                <td className="px-1.5 py-4 font-medium text-foreground">{row.full_name}</td>
                <td className="px-1.5 py-4 text-muted">{row.entry_count}</td>
                <td className="px-1.5 py-4 font-bold text-accent-600">{formatHours(Number(row.total_seconds))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  لا توجد بيانات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
