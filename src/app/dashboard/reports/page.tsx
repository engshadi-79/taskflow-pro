import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodTabs } from "@/components/dashboard/period-tabs";
import { ReportStatCard } from "@/components/dashboard/report-stat-card";
import { DepartmentHoursChart } from "@/components/dashboard/department-hours-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart";
import { RecentTasksPanel } from "@/components/dashboard/recent-tasks-panel";
import {
  AlertIcon,
  ChartIcon,
  CheckCircleIcon,
  DownloadIcon,
  TrophyIcon,
} from "@/components/shared/icons";
import {
  parsePeriod,
  periodRange,
  pctDelta,
  toDateKey,
  type ReportPeriod,
} from "@/lib/report-periods";
import type { TaskStatus, TaskWithAssignee } from "@/lib/types/task";

type TopDepartmentRow = { department_id: string; department_name: string; completed_count: number };
type DailyRow = { day: string; created_count: number; completed_count: number };

const MONTH_LABEL = new Intl.DateTimeFormat("ar", { month: "short" });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const period: ReportPeriod = parsePeriod((await searchParams).period);
  const { since, until, prevSince, prevUntil } = periodRange(period);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();
  const prevSinceIso = prevSince.toISOString();
  const prevUntilIso = prevUntil.toISOString();

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
    { data: topDepartmentsRaw },
    { data: dailySeriesRaw },
    { data: deptHoursRaw },
    { data: statusBreakdownRaw },
    { data: recentTasksRaw },
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
  ]);

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="التقارير"
        subtitle="نظرة شاملة على أداء الفريق والإنتاجية"
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

      <PeriodTabs active={period} />

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DepartmentHoursChart
          rows={deptHours
            .filter((d) => d.avg_hours !== null)
            .map((d) => ({ name: d.department_name, hours: d.avg_hours as number }))}
        />
        <MonthlyTrendChart rows={monthly} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RecentTasksPanel tasks={recentTasks} />
        <StatusDonutChart
          rows={statusBreakdown.map((r) => ({ status: r.status, count: r.task_count }))}
        />
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
