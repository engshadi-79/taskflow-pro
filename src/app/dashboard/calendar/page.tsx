import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarIcon } from "@/components/shared/icons";
import { CalendarGrid, type CalendarCell } from "@/components/dashboard/calendar-grid";
import {
  addDays,
  formatDateKey,
  monthGridStart,
  monthLabel,
  parseDateKey,
  startOfWeek,
  todayKey,
  type DateKey,
} from "@/lib/calendar-dates";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/types/task";

type ViewMode = "month" | "week" | "day";

function shiftAnchor(date: DateKey, view: ViewMode, direction: 1 | -1): DateKey {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addDays(date, direction * 7);
  const d = parseDateKey(date);
  return formatDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1)));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    employee_id?: string;
    department_id?: string;
    project_id?: string;
    status?: string;
    priority?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;
  const view: ViewMode = params.view === "week" || params.view === "day" ? params.view : "month";
  const anchor: DateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();

  const rangeStart: DateKey =
    view === "month" ? monthGridStart(anchor) : view === "week" ? startOfWeek(anchor) : anchor;
  const rangeEnd: DateKey = view === "month" ? addDays(rangeStart, 41) : view === "week" ? addDays(rangeStart, 6) : anchor;

  const supabase = await createClient();

  let employeeIds: string[] | null = null;
  if (params.department_id) {
    const { data } = await supabase.from("users").select("id").eq("department_id", params.department_id);
    employeeIds = (data ?? []).map((u) => u.id);
  }

  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assigned_to, is_recurring, assignee:users!tasks_assigned_to_fkey(full_name)"
    )
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .not("due_date", "is", null);

  if (params.employee_id) taskQuery = taskQuery.eq("assigned_to", params.employee_id);
  else if (employeeIds) taskQuery = taskQuery.in("assigned_to", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (params.project_id) taskQuery = taskQuery.eq("project_id", params.project_id);
  if (params.status) taskQuery = taskQuery.eq("status", params.status);
  if (params.priority) taskQuery = taskQuery.eq("priority", params.priority);

  let milestoneQuery = supabase
    .from("project_milestones")
    .select("id, title, due_date, project:projects(name)")
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .not("due_date", "is", null);
  if (params.project_id) milestoneQuery = milestoneQuery.eq("project_id", params.project_id);

  let projectQuery = supabase
    .from("projects")
    .select("id, name, due_date")
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .not("due_date", "is", null);
  if (params.project_id) projectQuery = projectQuery.eq("id", params.project_id);

  let meetingQuery = supabase
    .from("meetings")
    .select("id, title, meeting_date, meeting_time")
    .gte("meeting_date", rangeStart)
    .lte("meeting_date", rangeEnd)
    .neq("status", "cancelled");
  if (params.project_id) meetingQuery = meetingQuery.eq("project_id", params.project_id);

  const [
    { data: tasks },
    { data: milestones },
    { data: projectDeadlines },
    { data: meetings },
    { data: departments },
    { data: projects },
    { data: employees },
  ] = await Promise.all([
    taskQuery.returns<
      {
        id: string;
        title: string;
        status: TaskStatus;
        priority: Priority;
        due_date: string;
        assigned_to: string;
        is_recurring: boolean;
        assignee: { full_name: string } | null;
      }[]
    >(),
    milestoneQuery.returns<{ id: string; title: string; due_date: string; project: { name: string } | null }[]>(),
    projectQuery.returns<{ id: string; name: string; due_date: string }[]>(),
    meetingQuery.returns<{ id: string; title: string; meeting_date: string; meeting_time: string | null }[]>(),
    profile.role === "super_admin" ? supabase.from("departments").select("id, name").order("name") : Promise.resolve({ data: [] }),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  const cellDates: DateKey[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    cellDates.push(d);
    if (d === rangeEnd) break;
  }

  const cells: CalendarCell[] = cellDates.map((date) => ({
    date,
    tasks: (tasks ?? [])
      .filter((t) => t.due_date === date)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        is_recurring: t.is_recurring,
        assignee_name: t.assignee?.full_name ?? null,
      })),
    milestones: (milestones ?? [])
      .filter((m) => m.due_date === date)
      .map((m) => ({ id: m.id, title: m.title, project_name: m.project?.name ?? "" })),
    projectDeadlines: (projectDeadlines ?? [])
      .filter((p) => p.due_date === date)
      .map((p) => ({ id: p.id, name: p.name })),
    meetings: (meetings ?? [])
      .filter((m) => m.meeting_date === date)
      .map((m) => ({ id: m.id, title: m.title, meeting_time: m.meeting_time })),
  }));

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "view" && key !== "date") baseParams.set(key, value);
  }
  function linkFor(overrides: Record<string, string>) {
    const qp = new URLSearchParams(baseParams);
    for (const [k, v] of Object.entries(overrides)) qp.set(k, v);
    return `/dashboard/calendar?${qp.toString()}`;
  }

  const title = view === "month" ? monthLabel(anchor) : view === "week" ? `أسبوع ${monthLabel(anchor)}` : anchor;

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="التقويم"
        subtitle="المهام والمراحل والاجتماعات والمواعيد النهائية في مكان واحد"
        variant="violet"
        icon={<CalendarIcon className="h-6 w-6" />}
      >
        <div className="flex items-center gap-1.5">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <Link
              key={v}
              href={linkFor({ view: v })}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
                view === v ? "bg-white text-accent-700" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {v === "month" ? "شهر" : v === "week" ? "أسبوع" : "يوم"}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-center text-sm font-bold text-foreground sm:hidden">{title}</span>
          <div className="flex items-center gap-2">
            <Link
              href={linkFor({ view, date: shiftAnchor(anchor, view, -1) })}
              className="flex-1 shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-center text-sm text-foreground hover:bg-background sm:flex-initial"
            >
              ‹ السابق
            </Link>
            <Link
              href={linkFor({ view, date: todayKey() })}
              className="flex-1 shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-center text-sm text-foreground hover:bg-background sm:flex-initial"
            >
              اليوم
            </Link>
            <Link
              href={linkFor({ view, date: shiftAnchor(anchor, view, 1) })}
              className="flex-1 shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-center text-sm text-foreground hover:bg-background sm:flex-initial"
            >
              التالي ›
            </Link>
          </div>
          <span className="hidden text-sm font-bold text-foreground sm:ms-2 sm:block">{title}</span>
        </div>

        <form method="get" className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={anchor} />
          {profile.role === "super_admin" && (
            <select name="department_id" defaultValue={params.department_id ?? ""} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto">
              <option value="">كل الأقسام</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <select name="employee_id" defaultValue={params.employee_id ?? ""} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto">
            <option value="">كل الموظفين</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <select name="project_id" defaultValue={params.project_id ?? ""} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto">
            <option value="">كل المشاريع</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto">
            <option value="">كل الحالات</option>
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select name="priority" defaultValue={params.priority ?? ""} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 sm:w-auto">
            <option value="">كل الأولويات</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
          <button type="submit" className="w-full rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 sm:w-auto">
            تصفية
          </button>
        </form>
      </div>

      <CalendarGrid
        cells={cells}
        view={view}
        anchorMonth={anchor}
        canManage={profile.role === "super_admin" || profile.role === "department_manager"}
        currentUserId={profile.id}
      />
    </div>
  );
}
