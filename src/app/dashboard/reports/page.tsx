import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { ChartIcon, DownloadIcon } from "@/components/shared/icons";

type TopEmployeeRow = { user_id: string; full_name: string; completed_count: number };
type TopDepartmentRow = { department_id: string; department_name: string; completed_count: number };

export default async function ReportsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [
    { data: topEmployeesRaw },
    { data: topDepartmentsRaw },
    { data: avgHours },
    { data: delayRate },
  ] = await Promise.all([
    supabase.rpc("report_top_employees"),
    supabase.rpc("report_top_departments"),
    supabase.rpc("report_avg_completion_hours"),
    supabase.rpc("report_delay_rate"),
  ]);

  const topEmployees = (topEmployeesRaw ?? []) as TopEmployeeRow[];
  const topDepartments = (topDepartmentsRaw ?? []) as TopDepartmentRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير"
        subtitle="نظرة شاملة على أداء الفريق"
        variant="navy"
        icon={<ChartIcon className="h-6 w-6" />}
      >
        <a
          href="/api/reports/export"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
        >
          <DownloadIcon className="h-4 w-4" />
          تصدير Excel
        </a>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="متوسط وقت الإنجاز"
          value={avgHours ? `${avgHours} ساعة` : "—"}
          tone="teal"
          icon={<ChartIcon className="h-[22px] w-[22px]" />}
        />
        <StatCard
          label="نسبة التأخير"
          value={`${delayRate ?? 0}%`}
          tone="amber"
          icon={<ChartIcon className="h-[22px] w-[22px]" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">أكثر الموظفين إنجازًا</h2>
          {topEmployees && topEmployees.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {topEmployees.map((row, index) => (
                <li key={row.user_id} className="flex items-center justify-between">
                  <span className="text-foreground">
                    {index + 1}. {row.full_name}
                  </span>
                  <span className="font-semibold text-accent-700">{row.completed_count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
          )}
        </div>

        {profile.role === "super_admin" && (
          <div className="rounded-[18px] border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">أكثر الأقسام إنتاجية</h2>
            {topDepartments && topDepartments.length > 0 ? (
              <ol className="space-y-2 text-sm">
                {topDepartments.map((row, index) => (
                  <li key={row.department_id} className="flex items-center justify-between">
                    <span className="text-foreground">
                      {index + 1}. {row.department_name}
                    </span>
                    <span className="font-semibold text-accent-700">{row.completed_count}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
