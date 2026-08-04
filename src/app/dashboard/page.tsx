import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { EmployeeTaskList } from "@/components/dashboard/employee-task-list";
import {
  HeroCard,
  KpiCard,
  DistributionPanel,
  TrendPanel,
  TopPerformerRow,
  ActivityRow,
} from "@/components/dashboard/dashboard-widgets";
import { PRIORITY_LABEL, type Priority, type Task } from "@/lib/types/task";
import { timeAgo } from "@/lib/format-time-ago";

type WeeklyTopEmployeeRow = { user_id: string; full_name: string; completed_count: number };
type DistributionByDeptRow = { department_name: string; task_count: number };
type DistributionByPriorityRow = { priority: Priority; task_count: number };
type TrendRow = { day: string; completed_count: number };
type ActivityLogRow = {
  id: string;
  description: string;
  created_at: string;
  actor: { full_name: string } | null;
};

const ROW_COLORS = ["var(--accent-500)", "var(--green-500)", "var(--orange-500)", "var(--pink-500)"];

function pctDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  if (profile.role === "employee") {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", profile.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<Task[]>();

    return (
      <div className="space-y-6">
        <div className="font-display text-[22px] font-extrabold text-foreground">
          أهلاً، {profile.full_name.split(" ")[0]}
          <span className="ms-2 font-body text-[15px] font-medium text-muted">
            — هذه مهامك اليوم
          </span>
        </div>
        <EmployeeTaskList tasks={tasks ?? []} />
      </div>
    );
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [
    { count: employeeCount },
    { count: totalMembers },
    { count: departmentCount },
    { count: completedCount },
    { count: totalCount },
    { count: pendingCount },
    { count: unreadCount },
    { count: completedThisWeek },
    { count: completedLastWeek },
    { count: newThisWeek },
    { count: newLastWeek },
    { data: weeklyTopEmployeesRaw },
    { data: distributionRaw },
    { data: trendRaw },
    { data: activityRaw },
    { data: ownDepartment },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "employee"),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("departments").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "in_progress", "pending_review"]),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", weekAgo),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", twoWeeksAgo)
      .lt("updated_at", weekAgo),
    supabase.from("tasks").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .gte("created_at", twoWeeksAgo)
      .lt("created_at", weekAgo),
    supabase.rpc("report_weekly_top_employees"),
    profile.role === "super_admin"
      ? supabase.rpc("report_task_distribution_by_department")
      : supabase.rpc("report_task_distribution_by_priority"),
    supabase.rpc("report_weekly_trend"),
    supabase
      .from("activity_log")
      .select("id, description, created_at, actor:users(full_name)")
      .order("created_at", { ascending: false })
      .limit(4),
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const completionRate =
    totalCount && totalCount > 0 ? Math.round(((completedCount ?? 0) / totalCount) * 100) : 0;

  const weeklyTopEmployees = (weeklyTopEmployeesRaw ?? []) as WeeklyTopEmployeeRow[];
  const trend = (trendRaw ?? []) as TrendRow[];
  const activity = (activityRaw ?? []) as unknown as ActivityLogRow[];

  const distributionRows =
    profile.role === "super_admin"
      ? (distributionRaw as DistributionByDeptRow[] | null ?? []).map((row) => ({
          label: row.department_name,
          count: row.task_count,
        }))
      : (distributionRaw as DistributionByPriorityRow[] | null ?? []).map((row) => ({
          label: PRIORITY_LABEL[row.priority],
          count: row.task_count,
        }));

  return (
    <div className="space-y-4.5">
      <div className="font-display text-[22px] font-extrabold text-foreground">
        أهلاً، {profile.full_name.split(" ")[0]}
        <span className="ms-2 font-body text-[15px] font-medium text-muted">
          — هذا وضع فريقك اليوم
        </span>
      </div>

      <div className="my-5 grid grid-cols-1 gap-4.5 lg:grid-cols-[1.65fr_1fr_1fr]">
        <HeroCard
          weekCount={completedThisWeek ?? 0}
          deltaPercent={pctDelta(completedThisWeek ?? 0, completedLastWeek ?? 0)}
          teamCompleted={completedThisWeek ?? 0}
          teamPending={pendingCount ?? 0}
        />
        <KpiCard
          tone="orange"
          title="مهام جديدة"
          value={newThisWeek ?? 0}
          progress={Math.min(((newThisWeek ?? 0) / Math.max(newThisWeek ?? 0, newLastWeek ?? 1, 1)) * 100, 100)}
          foot={`${pctDelta(newThisWeek ?? 0, newLastWeek ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(pctDelta(newThisWeek ?? 0, newLastWeek ?? 0))}٪ عن الأسبوع الماضي`}
        />
        <KpiCard
          tone="pink"
          title="إشعارات غير مقروءة"
          value={unreadCount ?? 0}
          progress={Math.min((unreadCount ?? 0) * 10, 100)}
          foot="التنبيهات الحالية بانتظار قراءتك"
        />
        <KpiCard
          tone="green"
          title="أعضاء نشطون"
          value={employeeCount ?? 0}
          progress={totalMembers ? ((employeeCount ?? 0) / totalMembers) * 100 : 0}
          foot={`من أصل ${totalMembers ?? 0} عضو`}
        />
        <KpiCard
          tone="purple"
          title="معدل الإنجاز"
          value={`${completionRate}٪`}
          progress={completionRate}
          foot={`${completedCount ?? 0} من ${totalCount ?? 0} مهمة`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[1fr_1.2fr_1.3fr]">
        <div className="rounded-[18px] border border-border bg-surface p-[22px]">
          <div className="mb-4">
            <h4 className="text-[14.5px] font-extrabold text-foreground">
              {profile.role === "super_admin" ? "إجمالي الأعضاء" : "أعضاء القسم"}
            </h4>
            <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
              عدد حسابات الفريق المسجّلة
            </small>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[30px] text-foreground">{totalMembers ?? 0}</div>
              <div className="mt-1 text-xs font-bold text-faint">
                {profile.role === "super_admin"
                  ? `عبر ${departmentCount ?? 0} قسم`
                  : (ownDepartment as { name: string } | null)?.name
                    ? `في قسم ${(ownDepartment as { name: string }).name}`
                    : "بدون قسم"}
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-lg text-accent-500">
              👥
            </div>
          </div>
        </div>

        <DistributionPanel
          title="توزيع المهام"
          caption={profile.role === "super_admin" ? "حسب القسم" : "حسب الأولوية"}
          rows={distributionRows}
        />

        <TrendPanel counts={trend.map((r) => r.completed_count)} />
      </div>

      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-[18px] border border-border bg-surface p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[14.5px] font-extrabold text-foreground">
              الأكثر إنجازًا هذا الأسبوع
            </h4>
          </div>
          {weeklyTopEmployees.length === 0 ? (
            <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
          ) : (
            weeklyTopEmployees.map((row, i) => (
              <TopPerformerRow
                key={row.user_id}
                name={row.full_name}
                subtitle="عضو الفريق"
                count={row.completed_count}
                color={ROW_COLORS[i % ROW_COLORS.length]}
              />
            ))
          )}
        </div>

        <div className="rounded-[18px] border border-border bg-surface p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[14.5px] font-extrabold text-foreground">آخر النشاطات</h4>
            <small className="text-[11.5px] font-medium text-faint">أحدث تحديثات المهام</small>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">لا توجد نشاطات بعد</p>
          ) : (
            <table className="w-full">
              <tbody>
                {activity.map((row) => (
                  <ActivityRow
                    key={row.id}
                    description={row.description}
                    actorName={row.actor?.full_name ?? null}
                    timeAgo={timeAgo(row.created_at)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
