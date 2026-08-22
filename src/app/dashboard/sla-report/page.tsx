import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AlertIcon } from "@/components/shared/icons";
import type { SlaReport } from "@/lib/types/sla";

export default async function SlaReportPage({
  searchParams,
}: {
  searchParams: Promise<{ department_id?: string; user_id?: string }>;
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
  const userId = params.user_id || null;

  const supabase = await createClient();

  const [{ data: reportRows }, { data: departments }, { data: employees }] = await Promise.all([
    supabase.rpc("sla_report", { p_department_id: departmentId, p_user_id: userId }),
    profile.role === "super_admin"
      ? supabase.from("departments").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  const report = (reportRows as SlaReport[] | null)?.[0] ?? {
    total_count: 0,
    breached_count: 0,
    compliance_rate: 100,
    avg_response_minutes: null,
    avg_resolution_hours: null,
  };

  return (
    <div>
      <PageHeader
        title="تقرير SLA"
        subtitle="الالتزام بأوقات الاستجابة والإنجاز المتفق عليها"
        variant="navy"
        icon={<AlertIcon className="h-6 w-6" />}
        count={`${report.compliance_rate}٪ التزام`}
      />

      <form
        method="get"
        className="mb-4.5 grid grid-cols-1 gap-3 rounded-[18px] border border-border bg-surface p-4 sm:flex sm:flex-wrap sm:items-end"
      >
        {profile.role === "super_admin" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">القسم</span>
            <select
              name="department_id"
              defaultValue={departmentId ?? ""}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 sm:w-auto"
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 sm:w-auto"
          >
            <option value="">كل الموظفين</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="w-full rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 sm:w-auto"
        >
          تصفية
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard value={report.total_count} label="إجمالي المهام" tone="indigo" />
        <StatCard value={report.breached_count} label="متجاوزة" tone="red" />
        <StatCard value={`${report.compliance_rate}٪`} label="نسبة الالتزام" tone="green" />
        <StatCard
          value={report.avg_resolution_hours ?? "—"}
          label="متوسط وقت الإنجاز (ساعة)"
          tone="blue"
        />
      </div>

      <div className="mt-4.5 rounded-[18px] border border-border bg-surface p-5 text-sm text-muted">
        متوسط وقت الاستجابة:{" "}
        <span className="font-bold text-foreground">
          {report.avg_response_minutes !== null ? `${report.avg_response_minutes} دقيقة` : "لا توجد بيانات كافية"}
        </span>
      </div>
    </div>
  );
}
