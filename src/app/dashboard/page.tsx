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
  MiniListPanel,
} from "@/components/dashboard/dashboard-widgets";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickShortcuts } from "@/components/dashboard/quick-shortcuts";
import { StatCard } from "@/components/shared/stat-card";
import {
  BellIcon,
  CheckSquareIcon,
  ChartIcon,
  InboxIcon,
  UsersIcon,
} from "@/components/shared/icons";
import { PRIORITY_LABEL, type Priority, type Task } from "@/lib/types/task";
import { PROJECT_STATUS_LABEL } from "@/lib/types/project";
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
    const nowDate = new Date();
    const todayIso = nowDate.toISOString().slice(0, 10);
    const weekAheadIso = new Date(nowDate.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const [{ data: tasks }, { data: ownDept }, { data: workloadRows }, { data: statsRows }] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", profile.id)
          .order("due_date", { ascending: true, nullsFirst: false })
          .returns<Task[]>(),
        profile.department_id
          ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
          : Promise.resolve({ data: null }),
        // RLS on public.users restricts employee_workload()'s own internal
        // query to just this caller's row, so this returns exactly "my
        // workload" with no p_user_id parameter needed
        supabase.rpc("employee_workload"),
        supabase.rpc("report_employee_stats", { p_user_id: profile.id }),
      ]);

    const myTasks = tasks ?? [];
    const overdue = myTasks.filter(
      (t) =>
        t.status !== "completed" && t.due_date && t.due_date.slice(0, 10) < todayIso
    ).length;
    const dueToday = myTasks.filter(
      (t) => t.status !== "completed" && t.due_date?.slice(0, 10) === todayIso
    ).length;
    const upcoming = myTasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.due_date &&
        t.due_date.slice(0, 10) > todayIso &&
        t.due_date.slice(0, 10) <= weekAheadIso
    ).length;

    const myWorkload = (
      workloadRows as { load_percent: number; load_status: string; open_count: number }[] | null
    )?.[0];
    const myStats = (
      statsRows as
        | { completed_count: number; on_time_rate: number; avg_resolution_hours: number | null }[]
        | null
    )?.[0];

    return (
      <div className="space-y-5">
        <WelcomeBanner
          fullName={profile.full_name}
          role={profile.role}
          departmentName={(ownDept as { name: string } | null)?.name}
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            value={myTasks.length}
            label="إجمالي مهامي"
            tone="indigo"
            icon={<CheckSquareIcon className="h-[22px] w-[22px]" />}
            href="/dashboard/kanban"
          />
          <StatCard
            value={dueToday}
            label="مستحقة اليوم"
            tone="amber"
            icon={<InboxIcon className="h-[22px] w-[22px]" />}
            href="/dashboard/kanban"
          />
          <StatCard
            value={upcoming}
            label="قادمة (٧ أيام)"
            tone="blue"
            icon={<InboxIcon className="h-[22px] w-[22px]" />}
            href="/dashboard/kanban"
          />
          <StatCard
            value={overdue}
            label="مهام متأخرة"
            tone="red"
            icon={<BellIcon className="h-[22px] w-[22px]" />}
            href="/dashboard/kanban"
          />
        </div>

        <QuickShortcuts role={profile.role} />

        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
          <div className="rounded-[18px] border border-border bg-surface p-[22px]">
            <h4 className="mb-3 text-[14.5px] font-extrabold text-foreground">حملي الوظيفي</h4>
            {myWorkload ? (
              <>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="text-muted">{myWorkload.open_count} مهمة مفتوحة</span>
                  <b className="text-foreground">{myWorkload.load_percent}٪</b>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${Math.min(myWorkload.load_percent, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
            )}
          </div>

          <div className="rounded-[18px] border border-border bg-surface p-[22px]">
            <h4 className="mb-3 text-[14.5px] font-extrabold text-foreground">أدائي</h4>
            {myStats ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-display text-[20px] text-foreground">{myStats.completed_count}</div>
                  <span className="text-[11px] text-faint">مكتملة</span>
                </div>
                <div>
                  <div className="font-display text-[20px] text-foreground">{myStats.on_time_rate}٪</div>
                  <span className="text-[11px] text-faint">بالوقت</span>
                </div>
                <div>
                  <div className="font-display text-[20px] text-foreground">
                    {myStats.avg_resolution_hours ?? "—"}
                  </div>
                  <span className="text-[11px] text-faint">ساعة/مهمة</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
            )}
          </div>
        </div>

        <EmployeeTaskList tasks={myTasks} />
      </div>
    );
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  // a department_manager's view of these three is scoped to their own
  // department; super_admin passes null for org-wide - RLS would enforce
  // the same boundary regardless, this just makes the framing explicit
  // ("Department Tasks" vs "Organization Overview" per Prompt 14)
  const scopeDepartmentId = profile.role === "department_manager" ? profile.department_id : null;

  const [
    { count: employeeCount },
    { count: totalMembers },
    { count: departmentCount },
    { count: completedCount },
    { count: totalCount },
    { count: pendingCount },
    { count: overdueCount },
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
    { data: workloadRows },
    { data: slaRows },
    { data: projectRows },
    { count: projectCount },
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
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "overdue"),
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
    supabase.rpc("employee_workload", { p_department_id: scopeDepartmentId }),
    supabase.rpc("sla_report", { p_department_id: scopeDepartmentId }),
    supabase
      .from("projects")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("projects").select("*", { count: "exact", head: true }),
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

  const workload = (
    workloadRows as { user_id: string; full_name: string; load_percent: number }[] | null
  ) ?? [];
  const sla = (
    slaRows as { total_count: number; breached_count: number; compliance_rate: number }[] | null
  )?.[0] ?? { total_count: 0, breached_count: 0, compliance_rate: 100 };
  const projects = (projectRows as { id: string; name: string; status: string }[] | null) ?? [];

  return (
    <div className="space-y-4.5">
      <WelcomeBanner
        fullName={profile.full_name}
        role={profile.role}
        departmentName={(ownDepartment as { name: string } | null)?.name}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          value={totalCount ?? 0}
          label="إجمالي المهام"
          tone="indigo"
          icon={<CheckSquareIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/tasks"
        />
        <StatCard
          value={pendingCount ?? 0}
          label="مهام قائمة"
          tone="blue"
          icon={<InboxIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/kanban"
        />
        <StatCard
          value={overdueCount ?? 0}
          label="مهام متأخرة"
          tone="red"
          icon={<BellIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/tasks?status=overdue"
        />
        <StatCard
          value={completedCount ?? 0}
          label="مهام منجزة"
          tone="green"
          icon={<ChartIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/reports"
        />
        <StatCard
          value={unreadCount ?? 0}
          label="إشعارات غير مقروءة"
          tone="red"
          icon={<BellIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/notifications"
        />
        <StatCard
          value={totalMembers ?? 0}
          label={profile.role === "super_admin" ? "أعضاء الفريق" : "أعضاء القسم"}
          tone="amber"
          icon={<UsersIcon className="h-[22px] w-[22px]" />}
          href="/dashboard/employees"
        />
      </div>

      <QuickShortcuts role={profile.role} />

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
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-500">
              <UsersIcon className="h-5 w-5" />
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

      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
        <MiniListPanel
          title="الحمل الوظيفي"
          caption={profile.role === "super_admin" ? "الأعلى حملًا بالمؤسسة" : "الأعلى حملًا بالقسم"}
          href="/dashboard/workload"
          emptyLabel="لا توجد بيانات كافية بعد"
          rows={workload.slice(0, 5).map((w) => ({
            key: w.user_id,
            label: w.full_name,
            value: `${w.load_percent}٪`,
          }))}
        />

        <div className="rounded-[18px] border border-border bg-surface p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[14.5px] font-extrabold text-foreground">الالتزام بـ SLA</h4>
            <a href="/dashboard/sla-report" className="text-[12px] font-bold text-accent-600 hover:underline">
              التقرير الكامل
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="font-display text-[24px] text-green-600">{sla.compliance_rate}٪</div>
              <span className="text-[11px] text-faint">نسبة الالتزام</span>
            </div>
            <div>
              <div className="font-display text-[24px] text-brand-red-500">{sla.breached_count}</div>
              <span className="text-[11px] text-faint">متجاوزة من {sla.total_count}</span>
            </div>
          </div>
        </div>

        <MiniListPanel
          title="المشاريع"
          caption={`${projectCount ?? 0} مشروع`}
          href="/dashboard/projects"
          emptyLabel="لا توجد مشاريع بعد"
          rows={projects.map((p) => ({
            key: p.id,
            label: p.name,
            value: PROJECT_STATUS_LABEL[p.status as keyof typeof PROJECT_STATUS_LABEL] ?? p.status,
          }))}
        />
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
