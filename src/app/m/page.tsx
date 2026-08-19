import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { MobileRing } from "@/components/mobile/mobile-ring";
import { MOBILE_GRADIENT_PRIMARY, MOBILE_STATUS_STYLE, MOBILE_PRIORITY_STYLE } from "@/lib/mobile-theme";
import { STATUS_LABEL, type Task } from "@/lib/types/task";

type SummaryCounts = {
  active_count: number;
  pending_review_count: number;
  team_overdue_count: number;
  pending_approvals_count: number;
  completed_count: number;
  total_count: number;
};

export default async function MobileDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isManagerRole = profile.role !== "employee";
  const nowDate = new Date();
  const todayIso = nowDate.toISOString().slice(0, 10);

  // Meetings I'm attending, upcoming - same shape for both roles, reused
  // as-is from the desktop employee dashboard's own query.
  const { data: myMeetingsRaw } = await supabase
    .from("meeting_attendees")
    .select("meeting:meetings!inner(id, title, meeting_date, meeting_time, status)")
    .eq("user_id", profile.id)
    .gte("meetings.meeting_date", todayIso)
    .neq("meetings.status", "cancelled")
    .order("meeting_date", { referencedTable: "meetings", ascending: true })
    .order("meeting_time", { referencedTable: "meetings", ascending: true, nullsFirst: true })
    .limit(3);
  const myMeetings =
    (myMeetingsRaw as { meeting: { id: string; title: string; meeting_date: string; meeting_time: string | null } }[] | null)?.map(
      (r) => r.meeting
    ) ?? [];

  let summaryRows: { value: number; label: string }[] = [];
  let ringValue = 0;
  let ringLabel = "";
  let progressLabel = "";
  let progressValue = 0;
  let urgentTasks: { id: string; title: string; due_date: string | null; status: Task["status"]; priority: Task["priority"] }[] = [];
  let approvalQueue: { id: string; title: string; template: { name: string } | null }[] = [];
  let stalledProjects: { id: string; name: string; due_date: string }[] = [];

  if (!isManagerRole) {
    const [{ data: tasks }, { data: workloadRows }] = await Promise.all([
      supabase.from("tasks").select("*").eq("assigned_to", profile.id).returns<Task[]>(),
      supabase.rpc("employee_workload"),
    ]);
    const myTasks = tasks ?? [];
    const overdue = myTasks.filter((t) => t.status !== "completed" && t.due_date && t.due_date.slice(0, 10) < todayIso).length;
    const dueToday = myTasks.filter((t) => t.status !== "completed" && t.due_date?.slice(0, 10) === todayIso).length;
    const completed = myTasks.filter((t) => t.status === "completed").length;
    const myWorkload = (workloadRows as { load_percent: number }[] | null)?.[0];

    summaryRows = [
      { value: myTasks.length, label: "إجمالي مهامي" },
      { value: dueToday, label: "مستحقة اليوم" },
      { value: overdue, label: "متأخرة" },
    ];
    ringValue = myTasks.length ? Math.round((completed / myTasks.length) * 100) : 0;
    ringLabel = "نسبة الإنجاز";
    progressLabel = "حملي الوظيفي";
    progressValue = myWorkload?.load_percent ?? 0;
    urgentTasks = myTasks
      .filter((t) => t.status !== "completed" && t.due_date && t.due_date.slice(0, 10) <= todayIso)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
      .slice(0, 3)
      .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status, priority: t.priority }));
  } else {
    const scopeDepartmentId = profile.role === "department_manager" ? profile.department_id : null;
    const [{ data: summaryRaw }, { data: slaRows }, { data: pendingApprovalsRaw }, { data: atRiskProjectsRaw }, { data: myUrgentTasksRaw }] =
      await Promise.all([
        supabase.rpc("dashboard_summary_counts", {
          p_employee_id: null,
          p_employee_ids: null,
          p_project_id: null,
          p_status: null,
          p_priority: null,
          p_since: new Date(nowDate.getTime() - 7 * 86400000).toISOString(),
          p_two_weeks_ago: new Date(nowDate.getTime() - 14 * 86400000).toISOString(),
          p_today: todayIso,
        }),
        supabase.rpc("sla_report", { p_department_id: scopeDepartmentId, p_user_id: null }),
        supabase
          .from("workflow_requests")
          .select("id, title, created_at, template:workflow_templates(name)")
          .eq("status", "pending")
          .neq("requested_by", profile.id)
          .order("created_at", { ascending: true })
          .limit(2),
        supabase
          .from("projects")
          .select("id, name, due_date")
          .eq("status", "active")
          .not("due_date", "is", null)
          .lt("due_date", todayIso)
          .order("due_date", { ascending: true })
          .limit(2),
        supabase
          .from("tasks")
          .select("id, title, due_date, status, priority")
          .eq("assigned_to", profile.id)
          .neq("status", "completed")
          .lte("due_date", todayIso)
          .order("due_date", { ascending: true })
          .limit(3),
      ]);

    const summary = (summaryRaw as SummaryCounts[] | null)?.[0];
    const sla = (slaRows as { compliance_rate: number }[] | null)?.[0];
    const completionRate =
      summary?.total_count && summary.total_count > 0 ? Math.round(((summary.completed_count ?? 0) / summary.total_count) * 100) : 0;

    summaryRows = [
      { value: summary?.active_count ?? 0, label: "نشطة" },
      { value: summary?.pending_review_count ?? 0, label: "بانتظار المراجعة" },
      { value: summary?.team_overdue_count ?? 0, label: "متأخرة" },
    ];
    ringValue = completionRate;
    ringLabel = "معدل الإنجاز";
    progressLabel = "الالتزام بـ SLA";
    progressValue = sla?.compliance_rate ?? 100;
    approvalQueue = (pendingApprovalsRaw as { id: string; title: string; template: { name: string } | null }[] | null) ?? [];
    stalledProjects = (atRiskProjectsRaw as { id: string; name: string; due_date: string }[] | null) ?? [];
    // "urgent" here reuses the manager's own overdue/due-today assignments,
    // same source as the desktop dashboard's "مهامي العاجلة" widget.
    urgentTasks = (
      (myUrgentTasksRaw as { id: string; title: string; due_date: string | null; status: Task["status"]; priority: Task["priority"] }[] | null) ?? []
    );
  }

  return (
    <div>
      <div className="px-4 pb-[46px] pt-[54px] text-white" style={{ backgroundImage: MOBILE_GRADIENT_PRIMARY }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <form action={signOut}>
              <button type="submit" aria-label="تسجيل الخروج" className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </form>
            <Link href="/m/settings" aria-label="الإعدادات" className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-white/15">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.7 1.7M7.7 16.3 6 18M18 18l-1.7-1.7M7.7 7.7 6 6" />
              </svg>
            </Link>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold">
            {profile.role === "super_admin" ? "مدير عام" : profile.role === "department_manager" ? "مدير قسم" : "موظف"}
          </span>
        </div>
        <div className="mb-1 text-[13px] font-bold text-white/85">{isManagerRole ? "مرحبًا بك 👋" : `مرحبًا، ${profile.full_name.split(" ")[0]}`}</div>
        <div className="text-[19px] font-black">{profile.full_name}</div>
      </div>

      <div className="-mt-8 px-4">
        <div className="rounded-[20px] bg-surface p-4 pt-4 shadow-[0_10px_24px_rgba(30,41,59,.08)]">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-3">
              {summaryRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2.5">
                  <span className="text-[16px] font-black text-foreground">{row.value}</span>
                  <span className="text-[11px] font-bold text-faint">{row.label}</span>
                </div>
              ))}
            </div>
            <MobileRing value={ringValue} label={ringLabel} />
          </div>
          <div className="mb-1.5 mt-3.5 flex items-center justify-between text-[11.5px] font-bold text-foreground">
            <span>{progressLabel}</span>
            <span className="text-teal-600">{progressValue}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-teal-50">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(progressValue, 100)}%` }} />
          </div>
        </div>
      </div>

      {urgentTasks.length > 0 && (
        <div className="px-4 pb-2 pt-5">
          <h3 className="mb-2.5 text-[14px] font-extrabold text-foreground">مهامي العاجلة</h3>
          <div className="flex flex-col gap-2.5">
            {urgentTasks.map((t) => (
              <Link
                key={t.id}
                href={`/m/tasks/${t.id}`}
                className="flex items-center gap-2.5 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${MOBILE_PRIORITY_STYLE[t.priority].dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold text-foreground">{t.title}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-muted">{t.due_date ?? "بدون موعد"}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${MOBILE_STATUS_STYLE[t.status].badge}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isManagerRole && (
        <div className="px-4 pb-2 pt-1">
          <h3 className="mb-2.5 text-[14px] font-extrabold text-foreground">طلبات تحتاج موافقة</h3>
          <div className="mb-4.5 flex flex-col gap-2.5">
            {approvalQueue.length === 0 && <p className="text-[12.5px] text-muted">لا توجد طلبات بانتظار موافقتك</p>}
            {approvalQueue.map((r) => (
              <Link
                key={r.id}
                href="/m/requests"
                className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]"
              >
                <div className="text-[13.5px] font-bold text-foreground">{r.template?.name ? `${r.title} (${r.template.name})` : r.title}</div>
              </Link>
            ))}
          </div>

          <h3 className="mb-2.5 text-[14px] font-extrabold text-foreground">مشاريع متعثرة</h3>
          <div className="flex flex-col gap-2.5">
            {stalledProjects.length === 0 && <p className="text-[12.5px] text-muted">لا توجد مشاريع متعثرة</p>}
            {stalledProjects.map((p) => (
              <Link
                key={p.id}
                href={`/m/projects/${p.id}`}
                className="rounded-[14px] border border-brand-red-100 bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-foreground">{p.name}</span>
                  <span className="shrink-0 text-[11px] font-extrabold text-brand-red-600">
                    متأخر منذ {Math.max(1, Math.round((new Date(todayIso).getTime() - new Date(p.due_date).getTime()) / 86400000))} يوم
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-6 pt-1">
        <h3 className="mb-2.5 text-[14px] font-extrabold text-foreground">اجتماعاتي القادمة</h3>
        <div className="flex flex-col gap-2.5">
          {myMeetings.length === 0 && <p className="text-[12.5px] text-muted">لا توجد اجتماعات قادمة</p>}
          {myMeetings.map((m) => (
            <Link
              key={m.id}
              href={`/m/meetings/${m.id}`}
              className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]"
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-teal-50 text-teal-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                  <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-foreground">{m.title}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">
                  {m.meeting_time
                    ? `${new Date(m.meeting_date).toLocaleDateString("ar")} - ${m.meeting_time.slice(0, 5)}`
                    : new Date(m.meeting_date).toLocaleDateString("ar")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
