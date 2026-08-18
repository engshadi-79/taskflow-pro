import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectDeleteButton } from "@/components/dashboard/project-delete-button";
import { BriefcaseIcon, PlusIcon } from "@/components/shared/icons";
import { PROJECT_STATUS_LABEL, type ProjectWithManager } from "@/lib/types/project";
import { PRIORITY_LABEL } from "@/lib/types/task";

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-background text-muted",
  medium: "bg-brand-blue-50 text-brand-blue-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-brand-red-50 text-brand-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  planning: "bg-border text-foreground",
  active: "bg-accent-50 text-accent-700",
  on_hold: "bg-orange-50 text-orange-600",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted line-through",
  archived: "bg-border text-muted",
};

export default async function ProjectsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "*, manager:users!projects_manager_id_fkey(id, full_name), department:departments(id, name)"
    )
    .order("created_at", { ascending: false })
    .returns<ProjectWithManager[]>();

  const projectIds = (projects ?? []).map((p) => p.id);
  // one query for every visible project's tasks, grouped client-side, instead
  // of one project_task_stats() round trip per card
  const { data: tasks } = projectIds.length
    ? await supabase
        .from("tasks")
        .select("project_id, status")
        .in("project_id", projectIds)
        .neq("status", "cancelled")
    : { data: [] };

  const statsByProject: Record<string, { total: number; completed: number }> = {};
  for (const task of tasks ?? []) {
    if (!task.project_id) continue;
    const s = statsByProject[task.project_id] ?? { total: 0, completed: 0 };
    s.total += 1;
    if (task.status === "completed") s.completed += 1;
    statsByProject[task.project_id] = s;
  }

  const canCreate = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <PageHeader
        title="المشاريع"
        subtitle="تنظيم المهام والمراحل ضمن مشاريع متكاملة"
        variant="violet"
        icon={<BriefcaseIcon className="h-6 w-6" />}
        count={`${projects?.length ?? 0} مشروع`}
      >
        {canCreate && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" />
            مشروع جديد
          </Link>
        )}
      </PageHeader>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stats = statsByProject[project.id] ?? { total: 0, completed: 0 };
            const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const canManageThis =
              profile.role === "super_admin" ||
              project.manager_id === profile.id ||
              (profile.role === "department_manager" && project.department_id === profile.department_id);

            return (
              <div
                key={project.id}
                className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/dashboard/projects/${project.id}`} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-[16px] text-foreground">{project.name}</h3>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_BADGE[project.status]}`}
                      >
                        {PROJECT_STATUS_LABEL[project.status]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold ${PRIORITY_BADGE[project.priority]}`}
                      >
                        {PRIORITY_LABEL[project.priority]}
                      </span>
                    </div>
                  </div>

                  {project.description && (
                    <p className="line-clamp-2 text-[13px] text-muted">{project.description}</p>
                  )}

                  <div className="mt-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-accent-500"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted">
                      <span>{rate}٪ إنجاز</span>
                      <span>
                        {stats.completed}/{stats.total} مهمة
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-muted">
                    <span>{project.manager?.full_name ?? "بدون مدير"}</span>
                    <span>{project.due_date ?? "—"}</span>
                  </div>
                </Link>

                {(canManageThis || profile.role === "super_admin") && (
                  <div className="flex items-center gap-3 border-t border-border pt-3">
                    {canManageThis && (
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="text-[12.5px] font-bold text-accent-600 hover:underline"
                      >
                        تعديل
                      </Link>
                    )}
                    {profile.role === "super_admin" && <ProjectDeleteButton projectId={project.id} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[18px] border border-border bg-surface p-10 text-center text-muted">
          لا توجد مشاريع بعد
        </div>
      )}
    </div>
  );
}
