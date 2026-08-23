import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/foundation/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodTabs } from "@/components/dashboard/period-tabs";
import { ReportStatCard } from "@/components/dashboard/report-stat-card";
import { DepartmentHoursChart } from "@/components/dashboard/department-hours-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart";
import { RecentTasksPanel } from "@/components/dashboard/recent-tasks-panel";
import { PerformanceTable, type PerformanceRow } from "@/components/dashboard/performance-table";
import { PerformanceBarChart } from "@/components/dashboard/performance-bar-chart";
import { MiniListPanel } from "@/components/dashboard/dashboard-widgets";
import {
  AlertIcon,
  ChartIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  TrophyIcon,
  XCircleIcon,
} from "@/components/shared/icons";
import {
  parsePeriod,
  periodRange,
  pctDelta,
  toDateKey,
  type ReportPeriod,
} from "@/lib/report-periods";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Priority,
  type TaskStatus,
  type TaskWithAssignee,
} from "@/lib/types/task";

type TopDepartmentRow = { department_id: string; department_name: string; completed_count: number };
type DailyRow = { day: string; created_count: number; completed_count: number };

const MONTH_LABEL = new Intl.DateTimeFormat("ar", { month: "short" });
const WEEK_LABEL = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" });

// same priority color coding already used for the calendar's task dots
// (src/components/dashboard/calendar-grid.tsx PRIORITY_DOT)
const PRIORITY_BAR_COLOR: Record<Priority, string> = {
  low: "bg-border",
  medium: "bg-brand-blue-500",
  high: "bg-orange-500",
  urgent: "bg-brand-red-500",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    department_id?: string;
    project_id?: string;
    priority?: string;
    status?: string;
  }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const period: ReportPeriod = parsePeriod(params.period);
  const { since, until, prevSince, prevUntil } = periodRange(period);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();
  const prevSinceIso = prevSince.toISOString();
  const prevUntilIso = prevUntil.toISOString();

  // a department_manager's own filter is fixed to their department - same
  // boundary RLS already enforces, just explicit here too
  const departmentFilter =
    profile.role === "department_manager" ? profile.department_id : params.department_id || null;
  const projectFilter = params.project_id || null;
  const priorityFilter = params.priority || null;
  const statusFilter = params.status || null;

  // 8 months of daily data covers the sparklines (sliced to the selected
  // period below) and the monthly trend chart from one query.
  const dailySeriesSince = new Date();
  dailySeriesSince.setMonth(dailySeriesSince.getMonth() - 7);
  dailySeriesSince.setDate(1);

  const supabase = await createClient();

  const [
    { count: completedNow },
    { count: completedPrev },
    { count: createdNow },
    { count: overdueNow },
    { count: activeNow },
    { count: activePrev },
    { data: topDepartmentsRaw, error: topDepartmentsError },
    { data: dailySeriesRaw, error: dailySeriesError },
    { data: deptHoursRaw, error: deptHoursError },
    { data: statusBreakdownRaw, error: statusBreakdownError },
    { data: recentTasksRaw, error: recentTasksError },
    { data: deptPerformanceRaw, error: deptPerformanceError },
    { data: employeePerformanceRaw, error: employeePerformanceError },
    { data: projectPerformanceRaw, error: projectPerformanceError },
    { data: priorityPerformanceRaw, error: priorityPerformanceError },
    { data: overdueByDeptRaw, error: overdueByDeptError },
    { data: projectsForFilter },
    { data: delayRateRaw, error: delayRateError },
    { data: avgCompletionHoursRaw, error: avgCompletionHoursError },
    { data: rejectionRateRaw, error: rejectionRateError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", sinceIso)
      .lt("updated_at", untilIso),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", prevSinceIso)
      .lt("updated_at", prevUntilIso),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceIso)
      .lt("created_at", untilIso),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .lt("created_at", untilIso),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .lt("created_at", prevUntilIso),
    supabase.rpc("report_top_departments"),
    supabase.rpc("report_daily_series", { p_since: toDateKey(dailySeriesSince) }),
    supabase.rpc("report_avg_hours_by_department"),
    supabase.rpc("report_status_breakdown"),
    supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<TaskWithAssignee[]>(),
    supabase.rpc("report_department_performance", {
      p_since: sinceIso,
      p_until: untilIso,
      p_priority: priorityFilter,
      p_status: statusFilter,
    }),
    supabase.rpc("report_employee_performance", {
      p_department_id: departmentFilter,
      p_since: sinceIso,
      p_until: untilIso,
      p_priority: priorityFilter,
      p_status: statusFilter,
    }),
    supabase.rpc("report_project_performance", {
      p_project_id: projectFilter,
      p_priority: priorityFilter,
    }),
    supabase.rpc("report_priority_performance", { p_since: sinceIso, p_until: untilIso }),
    supabase.rpc("report_overdue_by_department"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.rpc("report_delay_rate"),
    supabase.rpc("report_avg_completion_hours"),
    supabase.rpc("report_review_rejection_rate", {
      p_since: sinceIso,
      p_until: untilIso,
      p_department_id: departmentFilter,
    }),
  ]);

  // These RPCs return an empty result set on failure too (data: null), which
  // is indistinguishable from "genuinely no rows yet" on screen - the exact
  // gap that made the missing report_daily_series function look like empty
  // data instead of a missing-function error. Logging server-side (visible
  // in the terminal running `next dev`/the deploy logs, not to the client)
  // means the next silent failure shows up immediately instead of needing
  // another round of manual SQL probing.
  for (const [name, error] of [
    ["report_top_departments", topDepartmentsError],
    ["report_daily_series", dailySeriesError],
    ["report_avg_hours_by_department", deptHoursError],
    ["report_status_breakdown", statusBreakdownError],
    ["recent tasks query", recentTasksError],
    ["report_department_performance", deptPerformanceError],
    ["report_employee_performance", employeePerformanceError],
    ["report_project_performance", projectPerformanceError],
    ["report_priority_performance", priorityPerformanceError],
    ["report_overdue_by_department", overdueByDeptError],
    ["report_delay_rate", delayRateError],
    ["report_avg_completion_hours", avgCompletionHoursError],
    ["report_review_rejection_rate", rejectionRateError],
  ] as const) {
    if (error) console.error(`[reports] ${name} failed:`, error.message);
  }

  const topDepartments = (topDepartmentsRaw ?? []) as TopDepartmentRow[];
  const dailySeries = (dailySeriesRaw ?? []) as DailyRow[];
  const deptHours = (deptHoursRaw ?? []) as { department_name: string; avg_hours: number | null }[];
  const statusBreakdown = (statusBreakdownRaw ?? []) as { status: TaskStatus; task_count: number }[];
  const recentTasks = recentTasksRaw ?? [];

  // completion rate = completed / (everything that existed by the end of
  // the window and wasn't cancelled) - comparable across periods since the
  // denominator is a point-in-time snapshot, not "created in this window"
  const completionRateNow = activeNow ? Math.round(((completedNow ?? 0) / activeNow) * 100) : 0;
  const completionRatePrev = activePrev
    ? Math.round(((completedPrev ?? 0) / activePrev) * 100)
    : 0;

  const sinceKey = toDateKey(since);
  const periodDaily = dailySeries.filter((d) => d.day >= sinceKey);

  const topDepartment = topDepartments[0];
  const totalTopDeptCompletions = topDepartments.reduce((sum, d) => sum + d.completed_count, 0);
  const topDeptShare =
    topDepartment && totalTopDeptCompletions > 0
      ? Math.round((topDepartment.completed_count / totalTopDeptCompletions) * 100)
      : 0;

  const monthly = groupByMonth(dailySeries);
  const weekly = groupByWeek(dailySeries);

  const delayRate = (delayRateRaw as number | null) ?? 0;
  const avgCompletionHours = avgCompletionHoursRaw as number | null;
  const rejectionRate = (
    rejectionRateRaw as { total_reviews: number; rejected_count: number; rejection_rate: number }[] | null
  )?.[0] ?? { total_reviews: 0, rejected_count: 0, rejection_rate: 0 };

  type PerfRaw = {
    total_count: number;
    completed_count: number;
    overdue_count?: number;
    completion_rate: number;
    avg_hours: number | null;
  };

  const departmentPerformance: PerformanceRow[] = (
    (deptPerformanceRaw as (PerfRaw & { department_id: string; department_name: string })[] | null) ?? []
  ).map((r) => ({
    key: r.department_id,
    name: r.department_name,
    total: r.total_count,
    completed: r.completed_count,
    overdue: r.overdue_count,
    completionRate: r.completion_rate,
    avgHours: r.avg_hours,
  }));

  const employeePerformance: PerformanceRow[] = (
    (employeePerformanceRaw as (PerfRaw & { user_id: string; full_name: string })[] | null) ?? []
  ).map((r) => ({
    key: r.user_id,
    name: r.full_name,
    total: r.total_count,
    completed: r.completed_count,
    overdue: r.overdue_count,
    completionRate: r.completion_rate,
    avgHours: r.avg_hours,
  }));

  const projectPerformance: PerformanceRow[] = (
    (projectPerformanceRaw as (PerfRaw & { project_id: string; project_name: string })[] | null) ?? []
  ).map((r) => ({
    key: r.project_id,
    name: r.project_name,
    total: r.total_count,
    completed: r.completed_count,
    overdue: r.overdue_count,
    completionRate: r.completion_rate,
    avgHours: null,
  }));

  const priorityPerformance: PerformanceRow[] = (
    (priorityPerformanceRaw as (PerfRaw & { priority: Priority })[] | null) ?? []
  ).map((r) => ({
    key: r.priority,
    name: PRIORITY_LABEL[r.priority],
    total: r.total_count,
    completed: r.completed_count,
    completionRate: r.completion_rate,
    avgHours: r.avg_hours,
  }));

  const overdueByDepartment = (
    (overdueByDeptRaw as { department_id: string; department_name: string; overdue_count: number }[] | null) ?? []
  ).map((r) => ({ key: r.department_id, label: r.department_name, value: String(r.overdue_count) }));

  const { data: departmentsForFilter } =
    profile.role === "super_admin"
      ? await supabase.from("departments").select("id, name").order("name")
      : { data: null };

  return (
    <div className="space-y-5">
      <PageHeader
        title="التقارير"
        subtitle="نظرة شاملة على أداء الفريق والإنتاجية"
        variant="navy"
        icon={<ChartIcon className="h-6 w-6" />}
      >
        {can.buildReports(profile) && (
          <>
            <Link
              href="/dashboard/reports/builder"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
            >
              <ChartIcon className="h-4 w-4" />
              منشئ التقارير المخصّصة
            </Link>
            <Link
              href="/dashboard/reports/converter"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
            >
              <DownloadIcon className="h-4 w-4" />
              تحويل ملف Excel حسب قالب
            </Link>
          </>
        )}
        <a
          href="/api/reports/export"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
        >
          <DownloadIcon className="h-4 w-4" />
          تصدير Excel
        </a>
      </PageHeader>

      <PeriodTabs active={period} />

      {/* filters for the new Department/Employee/Project/Priority
          performance tables below - the existing widgets above keep using
          just the period tabs, unchanged */}
      <form method="get" className="grid grid-cols-1 gap-2 rounded-[18px] border border-border bg-surface p-4 sm:flex sm:flex-wrap sm:items-end sm:gap-2.5">
        <input type="hidden" name="period" value={period} />
        {profile.role === "super_admin" && (
          <select
            name="department_id"
            defaultValue={params.department_id ?? ""}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto"
          >
            <option value="">كل الأقسام</option>
            {(departmentsForFilter ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <select
          name="project_id"
          defaultValue={params.project_id ?? ""}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto"
        >
          <option value="">كل المشاريع</option>
          {(projectsForFilter ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={params.priority ?? ""}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto"
        >
          <option value="">كل الأولويات</option>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto"
        >
          <option value="">كل الحالات</option>
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button type="submit" className="w-full rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 sm:w-auto">
          تصفية
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="banner-violet relative overflow-hidden rounded-[16px] p-4 text-white">
          <TrophyIcon className="h-6 w-6" />
          <div className="mt-3 text-[11px] font-bold opacity-90">أفضل قسم إجمالًا</div>
          <div className="mt-0.5 truncate font-display text-[19px]">
            {topDepartment?.department_name ?? "—"}
          </div>
          {topDepartment && (
            <>
              <div className="mt-1.5 text-[11px] opacity-90">
                {topDeptShare}٪ من إجمالي المهام المنجزة
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${topDeptShare}%` }}
                />
              </div>
            </>
          )}
        </div>

        <ReportStatCard
          label="المهام المتأخرة"
          value={overdueNow ?? 0}
          tone="red"
          icon={<AlertIcon className="h-5 w-5" />}
          deltaLabel="العدد الحالي، لحظيًا"
        />

        <ReportStatCard
          label="إجمالي المهام المنجزة"
          value={completedNow ?? 0}
          tone="blue"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          deltaPercent={pctDelta(completedNow ?? 0, completedPrev ?? 0)}
          sparkline={periodDaily.map((d) => d.completed_count)}
        />

        <ReportStatCard
          label="معدل الإنجاز"
          value={`${completionRateNow}٪`}
          tone="green"
          icon={<ChartIcon className="h-5 w-5" />}
          deltaPercent={completionRateNow - completionRatePrev}
          deltaLabel={`${createdNow ?? 0} مهمة جديدة هذه الفترة`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ReportStatCard
          label="نسبة التأخير"
          value={`${delayRate}٪`}
          tone="red"
          icon={<AlertIcon className="h-5 w-5" />}
          deltaLabel="من إجمالي المهام (متأخرة أو أُنجزت بعد موعدها)"
        />
        <ReportStatCard
          label="متوسط وقت الإنجاز"
          value={avgCompletionHours !== null ? `${avgCompletionHours} ساعة` : "—"}
          tone="blue"
          icon={<ClockIcon className="h-5 w-5" />}
          deltaLabel="لكل مهمة مكتملة، على مستوى المؤسسة"
        />
        <ReportStatCard
          label="معدل رفض المراجعة"
          value={`${rejectionRate.rejection_rate}٪`}
          tone="amber"
          icon={<XCircleIcon className="h-5 w-5" />}
          deltaLabel={`${rejectionRate.rejected_count} من ${rejectionRate.total_reviews} مراجعة خلال الفترة`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DepartmentHoursChart
          rows={deptHours
            .filter((d) => d.avg_hours !== null)
            .map((d) => ({ name: d.department_name, hours: d.avg_hours as number }))}
        />
        <MonthlyTrendChart rows={monthly} />
      </div>

      <MonthlyTrendChart rows={weekly} title="الاتجاه الأسبوعي" subtitle="مقارنة بين المهام المضافة والمنجزة أسبوعيًا" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RecentTasksPanel tasks={recentTasks} />
        <StatusDonutChart
          rows={statusBreakdown.map((r) => ({ status: r.status, count: r.task_count }))}
        />
      </div>

      {profile.role === "super_admin" && (
        <div>
          <h3 className="mb-2.5 text-[14.5px] font-extrabold text-foreground">أداء الأقسام</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PerformanceBarChart
              title="نسبة الإنجاز حسب القسم"
              subtitle="مقارنة سريعة بين الأقسام"
              rows={departmentPerformance}
            />
            <PerformanceTable rows={departmentPerformance} nameHeader="القسم" />
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2.5 text-[14.5px] font-extrabold text-foreground">أداء الموظفين</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PerformanceBarChart
            title="نسبة الإنجاز حسب الموظف"
            subtitle="مقارنة سريعة بين الموظفين"
            rows={employeePerformance}
          />
          <PerformanceTable rows={employeePerformance} nameHeader="الموظف" />
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-[14.5px] font-extrabold text-foreground">أداء المشاريع</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PerformanceBarChart
            title="نسبة الإنجاز حسب المشروع"
            subtitle="مقارنة سريعة بين المشاريع"
            rows={projectPerformance}
          />
          <PerformanceTable rows={projectPerformance} nameHeader="المشروع" />
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-[14.5px] font-extrabold text-foreground">أداء المهام حسب الأولوية</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PerformanceBarChart
            title="نسبة الإنجاز حسب الأولوية"
            subtitle="مقارنة سريعة بين مستويات الأولوية"
            rows={priorityPerformance}
            colorFor={(row) => PRIORITY_BAR_COLOR[row.key as Priority]}
          />
          <PerformanceTable rows={priorityPerformance} nameHeader="الأولوية" />
        </div>
      </div>

      <MiniListPanel
        title="المهام المتأخرة حسب القسم"
        href="/dashboard/tasks?status=overdue"
        emptyLabel="لا توجد مهام متأخرة حاليًا"
        rows={overdueByDepartment}
      />

      <div className="rounded-[18px] border border-border bg-surface p-5">
        <h4 className="mb-3 text-[13px] font-extrabold text-foreground">تقارير أخرى</h4>
        <div className="flex flex-wrap gap-2.5">
          <a
            href="/dashboard/workload"
            className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-accent-50"
          >
            الحمل الوظيفي (Workload)
          </a>
          <a
            href="/dashboard/time-tracking"
            className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-accent-50"
          >
            سجلّ الوقت (Time Tracking)
          </a>
          <a
            href="/dashboard/sla-report"
            className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-accent-50"
          >
            الالتزام بـ SLA
          </a>
        </div>
      </div>
    </div>
  );
}

function groupByMonth(daily: DailyRow[]) {
  const buckets = new Map<string, { created: number; completed: number }>();

  for (const row of daily) {
    const monthKey = row.day.slice(0, 7); // YYYY-MM
    const bucket = buckets.get(monthKey) ?? { created: 0, completed: 0 };
    bucket.created += row.created_count;
    bucket.completed += row.completed_count;
    buckets.set(monthKey, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, totals]) => ({
      label: MONTH_LABEL.format(new Date(`${monthKey}-01T00:00:00`)),
      ...totals,
    }));
}

/** Same shape as groupByMonth, bucketed by the Sunday-starting week
 * instead - plain string/date-math on the `day` (YYYY-MM-DD) key, no
 * timezone concerns since it never touches local getters (same reasoning
 * calendar-dates.ts documents for its own UTC-only arithmetic). */
function groupByWeek(daily: DailyRow[]) {
  const buckets = new Map<string, { created: number; completed: number }>();

  for (const row of daily) {
    const d = new Date(`${row.day}T00:00:00Z`);
    const weekStart = new Date(d.getTime() - d.getUTCDay() * 86400000);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const bucket = buckets.get(weekKey) ?? { created: 0, completed: 0 };
    bucket.created += row.created_count;
    bucket.completed += row.completed_count;
    buckets.set(weekKey, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([weekKey, totals]) => ({
      label: WEEK_LABEL.format(new Date(`${weekKey}T00:00:00Z`)),
      ...totals,
    }));
}
