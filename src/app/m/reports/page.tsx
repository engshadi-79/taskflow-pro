import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MOBILE_STATUS_STYLE } from "@/lib/mobile-theme";
import { STATUS_LABEL, type TaskStatus } from "@/lib/types/task";
import { KPI_WEIGHTS, type EmployeeKpiEvaluation } from "@/lib/types/kpi";

export default async function MobileReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "performance" ? "performance" : "reports";

  const supabase = await createClient();
  const [{ data: statusBreakdownRaw }, { data: evaluationsRaw }] = await Promise.all([
    tab === "reports" ? supabase.rpc("report_status_breakdown") : Promise.resolve({ data: [] }),
    tab === "performance"
      ? supabase
          .from("employee_kpi_evaluations")
          .select("*")
          .eq("user_id", profile.id)
          .eq("status", "finalized")
          .order("period_end", { ascending: false })
          .limit(1)
          .returns<EmployeeKpiEvaluation[]>()
      : Promise.resolve({ data: [] }),
  ]);

  const statusBreakdown = (statusBreakdownRaw ?? []) as { status: TaskStatus; task_count: number }[];
  const maxCount = Math.max(1, ...statusBreakdown.map((r) => r.task_count));
  const latestEval = (evaluationsRaw as EmployeeKpiEvaluation[] | null)?.[0] ?? null;

  const kpiBreakdown = latestEval
    ? [
        { label: `نسبة الإنجاز (${KPI_WEIGHTS.completion * 100}%)`, value: latestEval.completion_score },
        { label: `الالتزام بالوقت (${KPI_WEIGHTS.on_time * 100}%)`, value: latestEval.on_time_score },
        { label: `الجودة (${KPI_WEIGHTS.quality * 100}%)`, value: latestEval.quality_score },
        { label: `تقييم المدير (${KPI_WEIGHTS.manager_evaluation * 100}%)`, value: latestEval.manager_evaluation_score ?? 0 },
      ]
    : [];

  return (
    <div>
      <MobileHeader title="التقارير والأداء" />
      <div className="px-4">
        <div className="mb-4 flex rounded-[12px] bg-background p-1">
          <Link
            href="/m/reports?tab=reports"
            className={`flex-1 rounded-[9px] py-2 text-center text-[12.5px] font-bold ${tab === "reports" ? "bg-accent-600 text-white" : "text-muted"}`}
          >
            التقارير
          </Link>
          <Link
            href="/m/reports?tab=performance"
            className={`flex-1 rounded-[9px] py-2 text-center text-[12.5px] font-bold ${tab === "performance" ? "bg-accent-600 text-white" : "text-muted"}`}
          >
            الأداء
          </Link>
        </div>
      </div>

      <div className="px-4 pb-6">
        {tab === "reports" ? (
          <div className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
            <div className="mb-3 text-[12.5px] font-extrabold text-foreground">توزيع المهام حسب الحالة</div>
            {statusBreakdown.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted">لا توجد بيانات كافية بعد</p>
            ) : (
              <div className="flex h-[90px] items-end gap-2.5">
                {statusBreakdown.map((r) => (
                  <div key={r.status} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <div
                      className={`w-full rounded-t-[6px] ${MOBILE_STATUS_STYLE[r.status].dot}`}
                      style={{ height: `${Math.max(15, (r.task_count / maxCount) * 100)}%` }}
                    />
                    <span className="text-[9.5px] font-bold text-muted">{STATUS_LABEL[r.status].split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="rounded-[14px] bg-surface p-4 text-center shadow-[0_4px_12px_rgba(30,41,59,.06)]">
              <div className="text-[30px] font-black text-accent-600">{latestEval?.total_score ?? "—"}</div>
              <div className="mt-0.5 text-[11.5px] font-semibold text-muted">التقييم الإجمالي (KPI)</div>
            </div>
            {kpiBreakdown.map((k) => (
              <div key={k.label}>
                <div className="mb-1.5 flex justify-between text-[12px] font-bold text-foreground">
                  <span>{k.label}</span>
                  <span>{k.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${k.value}%` }} />
                </div>
              </div>
            ))}
            {!latestEval && <p className="text-center text-[12.5px] text-muted">لا توجد تقييمات معتمَدة بعد</p>}
          </div>
        )}
      </div>
    </div>
  );
}
