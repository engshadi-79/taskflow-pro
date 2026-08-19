import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MOBILE_GRADIENT_PRIMARY, MOBILE_STATUS_STYLE } from "@/lib/mobile-theme";
import { STATUS_LABEL, PRIORITY_LABEL, type TaskWithAssignee } from "@/lib/types/task";
import {
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectMemberWithUser,
  type ProjectMilestone,
  type ProjectTaskStats,
} from "@/lib/types/project";

const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "نظرة عامة" },
  { key: "tasks", label: "المهام" },
  { key: "team", label: "الفريق" },
  { key: "milestones", label: "المراحل" },
];

const MILESTONE_DOT: Record<string, string> = {
  pending: "bg-faint",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
};

export default async function MobileProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, manager:users!projects_manager_id_fkey(id, full_name), department:departments(id, name)")
    .eq("id", id)
    .single<Project & { manager: { id: string; full_name: string } | null; department: { id: string; name: string } | null }>();

  if (!project) notFound();

  const tab = TABS.some((t) => t.key === tabParam) ? (tabParam as string) : "overview";

  const [{ data: tasks }, { data: milestones }, { data: members }, { data: statsRows }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .returns<TaskWithAssignee[]>(),
    supabase.from("project_milestones").select("*").eq("project_id", id).order("position", { ascending: true }).returns<ProjectMilestone[]>(),
    supabase.from("project_members").select("*, user:users(id, full_name, avatar_url)").eq("project_id", id).order("added_at", { ascending: true }).returns<ProjectMemberWithUser[]>(),
    supabase.rpc("project_task_stats", { p_project_id: id }),
  ]);

  const stats = (statsRows as ProjectTaskStats[] | null)?.[0] ?? {
    total_count: 0,
    completed_count: 0,
    in_progress_count: 0,
    overdue_count: 0,
    completion_rate: 0,
  };

  return (
    <div>
      <MobileHeader
        back
        gradient={MOBILE_GRADIENT_PRIMARY}
        subtitle="تفاصيل المشروع"
        title={project.name}
        chips={
          <>
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-[#4f46c9]">{PROJECT_STATUS_LABEL[project.status]}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold text-white">أولوية {PRIORITY_LABEL[project.priority]}</span>
          </>
        }
      />

      <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-background px-4 py-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/m/projects/${id}?tab=${t.key}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
              tab === t.key ? "bg-accent-600 text-white" : "bg-surface text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="px-4 pb-6">
        {tab === "overview" && (
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] leading-7 text-muted">{project.description || "لا يوجد وصف"}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="إجمالي المهام" value={stats.total_count} />
              <StatTile label="المكتملة" value={stats.completed_count} tone="text-green-600" />
              <StatTile label="قيد التنفيذ" value={stats.in_progress_count} tone="text-accent-600" />
              <StatTile label="المتأخرة" value={stats.overdue_count} tone="text-brand-red-500" />
            </div>
            <div className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-bold text-foreground">
                <span>نسبة الإنجاز</span>
                <span>{stats.completion_rate}٪</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-accent-500" style={{ width: `${stats.completion_rate}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-[14px] bg-surface p-3.5 text-[12.5px] shadow-[0_4px_12px_rgba(30,41,59,.06)]">
              <Row label="مدير المشروع" value={project.manager?.full_name ?? "—"} />
              <Row label="الموعد النهائي" value={project.due_date ?? "—"} />
              <Row label="القسم" value={project.department?.name ?? "على مستوى المؤسسة"} />
              <Row label="الأعضاء" value={String(members?.length ?? 0)} />
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="flex flex-col gap-2.5">
            {(tasks ?? []).map((task) => (
              <Link key={task.id} href={`/m/tasks/${task.id}`} className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{task.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${MOBILE_STATUS_STYLE[task.status].badge}`}>
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-muted">{task.assignee?.full_name ?? "—"}</div>
              </Link>
            ))}
            {(tasks ?? []).length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد مهام لهذا المشروع</p>}
          </div>
        )}

        {tab === "team" && (
          <div className="flex flex-col gap-2.5">
            {(members ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[13px] font-extrabold text-white">
                  {m.user?.full_name?.[0] ?? "—"}
                </span>
                <span className="text-[13px] font-bold text-foreground">{m.user?.full_name ?? "—"}</span>
              </div>
            ))}
            {(members ?? []).length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا يوجد أعضاء في هذا المشروع</p>}
          </div>
        )}

        {tab === "milestones" && (
          <div className="flex flex-col gap-2.5">
            {(milestones ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MILESTONE_DOT[m.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-foreground">{m.title}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-muted">
                    {m.due_date ?? "بدون موعد"} — {MILESTONE_STATUS_LABEL[m.status]}
                  </div>
                </div>
              </div>
            ))}
            {(milestones ?? []).length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد مراحل بعد</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
      <div className={`text-[19px] font-black ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-muted">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}
