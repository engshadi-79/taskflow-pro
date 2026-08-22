import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TrophyIcon } from "@/components/shared/icons";
import { KpiCreateForm } from "@/components/dashboard/kpi-create-form";
import { KpiPendingReviewList } from "@/components/dashboard/kpi-pending-review-list";
import { KpiHistoryTable } from "@/components/dashboard/kpi-history-table";
import type { EmployeeKpiEvaluation } from "@/lib/types/kpi";

export default async function PerformancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isManager = profile.role === "super_admin" || profile.role === "department_manager";
  const supabase = await createClient();

  const [{ data: evaluationsRaw }, { data: employees }] = await Promise.all([
    supabase
      .from("employee_kpi_evaluations")
      .select("*, employee:users!employee_kpi_evaluations_user_id_fkey(full_name)")
      .order("period_start", { ascending: false })
      .returns<(EmployeeKpiEvaluation & { employee: { full_name: string } | null })[]>(),
    isManager
      ? supabase.from("users").select("id, full_name").eq("role", "employee").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const evaluations = (evaluationsRaw ?? []).map((e) => ({
    ...e,
    employee_name: e.employee?.full_name ?? null,
  }));
  const pending = evaluations.filter((e) => e.status === "pending_manager_review");
  const finalized = evaluations.filter((e) => e.status === "finalized");

  return (
    <div className="mx-auto max-w-5xl space-y-4.5">
      <PageHeader
        title="الأداء والمؤشرات"
        subtitle="الإنجاز 30٪ + الالتزام بالوقت 25٪ + الجودة 25٪ + تقييم المدير 20٪"
        variant="navy"
        icon={<TrophyIcon className="h-6 w-6" />}
      />

      {isManager && (
        <div className="rounded-[18px] border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">بدء تقييم جديد</h2>
          <p className="mb-3 text-[12px] text-muted">
            تُحسَب الإنجاز والالتزام بالوقت والجودة تلقائيًا من بيانات الفترة المحدَّدة، ثم يبقى التقييم بانتظار درجتك أنت لاعتماده.
          </p>
          <KpiCreateForm employees={employees ?? []} />
        </div>
      )}

      {isManager && (
        <div className="rounded-[18px] border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">تقييمات بانتظار مراجعتك</h2>
          <KpiPendingReviewList rows={pending} />
        </div>
      )}

      <div className="rounded-[18px] border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-extrabold text-foreground">
          {isManager ? "سجل التقييمات المعتمَدة" : "سجل أدائي"}
        </h2>
        <KpiHistoryTable rows={finalized} showEmployeeColumn={isManager} />
      </div>
    </div>
  );
}
