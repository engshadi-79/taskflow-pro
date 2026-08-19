import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { PROJECT_STATUS_LABEL, type ProjectWithManager } from "@/lib/types/project";

const STATUS_BADGE: Record<string, string> = {
  planning: "bg-border text-foreground",
  active: "bg-accent-50 text-accent-700",
  on_hold: "bg-orange-50 text-orange-600",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted line-through",
  archived: "bg-border text-muted",
};

export default async function MobileProjectsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, manager:users!projects_manager_id_fkey(id, full_name), department:departments(id, name)")
    .order("created_at", { ascending: false })
    .returns<ProjectWithManager[]>();

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: tasks } = projectIds.length
    ? await supabase.from("tasks").select("project_id, status").in("project_id", projectIds).neq("status", "cancelled")
    : { data: [] };

  const statsByProject: Record<string, { total: number; completed: number }> = {};
  for (const task of tasks ?? []) {
    if (!task.project_id) continue;
    const s = statsByProject[task.project_id] ?? { total: 0, completed: 0 };
    s.total += 1;
    if (task.status === "completed") s.completed += 1;
    statsByProject[task.project_id] = s;
  }

  return (
    <div>
      <MobileHeader title="المشاريع" subtitle={`${projects?.length ?? 0} مشروع`} />
      <div className="flex flex-col gap-2.5 px-4 pb-6">
        {(projects ?? []).map((project) => {
          const stats = statsByProject[project.id] ?? { total: 0, completed: 0 };
          const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          return (
            <Link
              key={project.id}
              href={`/m/projects/${project.id}`}
              className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 text-[13.5px] font-bold text-foreground">{project.name}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${STATUS_BADGE[project.status]}`}>
                  {PROJECT_STATUS_LABEL[project.status]}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-accent-500" style={{ width: `${rate}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11.5px] font-semibold text-muted">
                <span>{project.manager?.full_name ?? "بدون مدير"}</span>
                <span>{project.due_date ?? "—"}</span>
              </div>
            </Link>
          );
        })}
        {(projects ?? []).length === 0 && <p className="py-10 text-center text-[13px] text-muted">لا توجد مشاريع بعد</p>}
      </div>
    </div>
  );
}
