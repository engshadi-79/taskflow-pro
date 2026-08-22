import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodTabs } from "@/components/dashboard/period-tabs";
import { InsightCard } from "@/components/dashboard/insight-card";
import { MiniListPanel } from "@/components/dashboard/dashboard-widgets";
import { AlertIcon } from "@/components/shared/icons";
import { parsePeriod, periodRange } from "@/lib/report-periods";
import { computeExecutiveInsights } from "@/lib/decisions/insights";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "employee") redirect("/dashboard");

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const window = periodRange(period);
  const departmentId = profile.role === "department_manager" ? profile.department_id : null;

  const supabase = await createClient();

  const [insights, { data: atRiskProjectsRaw }] = await Promise.all([
    computeExecutiveInsights(supabase, window, departmentId),
    // same definition as the manager dashboard's "مشاريع متعثرة" panel:
    // an active project whose due date has already passed - not a
    // fabricated risk score. RLS already scopes this to a department
    // manager's own department, so no extra filter is needed here.
    supabase
      .from("projects")
      .select("id, name, due_date")
      .eq("status", "active")
      .not("due_date", "is", null)
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(8),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const atRiskProjects = (atRiskProjectsRaw ?? []) as { id: string; name: string; due_date: string }[];
  const atRiskRows = atRiskProjects.map((p) => ({
    key: p.id,
    label: p.name,
    value: `متأخر منذ ${Math.max(1, Math.round((new Date(todayIso).getTime() - new Date(p.due_date).getTime()) / 86400000))} يوم`,
  }));

  return (
    <div>
      <PageHeader
        title="مركز القرار التنفيذي"
        subtitle="ماذا حدث، ولماذا، وما الإجراء المقترح — أرقام حقيقية فقط، لا مؤشرات مخترَعة"
        variant="navy"
        icon={<AlertIcon className="h-6 w-6" />}
      >
        {/* 4 pills (3 period tabs + the count) as one 2-column grid on
            mobile - PageHeader's own count prop would put this count badge
            on its own line since it's a separate flex item from PeriodTabs'
            own wrapped group. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
          <PeriodTabs active={period} basePath="/dashboard/decisions" bare />
          <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-center text-[13px] font-extrabold backdrop-blur-sm">
            {insights.length} ملاحظة
          </span>
        </div>
      </PageHeader>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[18px] border border-border bg-surface p-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-[13px] text-muted">
            لا توجد تغيّرات ملحوظة مقارنة بالفترة السابقة — كل المؤشرات ضمن نطاقها المعتاد.
          </p>
        </div>
      ) : (
        <div className="mb-4.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <MiniListPanel
          title="مشاريع متعثرة"
          caption="مشاريع نشطة تجاوزت موعدها المحدَّد"
          href="/dashboard/projects"
          rows={atRiskRows}
          emptyLabel="لا توجد مشاريع متعثرة حاليًا"
        />
      </div>
    </div>
  );
}
