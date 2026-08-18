import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs, type ProjectTabKey } from "@/components/dashboard/project-tabs";
import { ProjectForm } from "@/components/dashboard/project-form";
import { ProjectMilestones } from "@/components/dashboard/project-milestones";
import { ProjectTeam } from "@/components/dashboard/project-team";
import { TaskList } from "@/components/dashboard/task-list";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { InventoryTrackTabs } from "@/components/dashboard/inventory-track-tabs";
import { InventoryProjectLinker } from "@/components/dashboard/inventory-project-linker";
import { BriefcaseIcon, CalendarIcon, DownloadIcon, UserIcon } from "@/components/shared/icons";
import { PageHeader, HeaderChip } from "@/components/shared/page-header";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectMemberWithUser,
  type ProjectMilestone,
  type ProjectTaskStats,
} from "@/lib/types/project";
import { PRIORITY_LABEL, type TaskWithAssignee } from "@/lib/types/task";
import type { InventoryDailyCheck, InventoryTool, InventoryTrack } from "@/lib/types/inventory";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, manager:users!projects_manager_id_fkey(id, full_name), department:departments(id, name)"
    )
    .eq("id", id)
    .single<Project & { manager: { id: string; full_name: string } | null; department: { id: string; name: string } | null }>();

  // RLS already scopes this select to what `profile` may see - a missing
  // row here means either the project doesn't exist or isn't visible to
  // them, and both cases should read the same to avoid leaking existence
  if (!project) {
    notFound();
  }

  const canManageProject =
    profile.role === "super_admin" ||
    project.manager_id === profile.id ||
    (profile.role === "department_manager" && project.department_id === profile.department_id);

  const [
    { data: tasks },
    { data: milestones },
    { data: members },
    { data: employees },
    { data: departments },
    { data: statsRows },
    { data: activity },
    { data: inventoryTracksRaw },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .returns<TaskWithAssignee[]>(),
    supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", id)
      .order("position", { ascending: true })
      .returns<ProjectMilestone[]>(),
    supabase
      .from("project_members")
      .select("*, user:users(id, full_name, avatar_url)")
      .eq("project_id", id)
      .order("added_at", { ascending: true })
      .returns<ProjectMemberWithUser[]>(),
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.rpc("project_task_stats", { p_project_id: id }),
    supabase
      .from("activity_log")
      .select("id, description, action_type, created_at")
      .eq("entity_type", "project")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; description: string | null; action_type: string; created_at: string }[]>(),
    // RLS already scopes this to every track for super_admin, or only the
    // track(s) this specific viewer is personally responsible for - the
    // linker below (super_admin only) offers whichever of those aren't
    // already linked to this project.
    supabase
      .from("inventory_tracks")
      .select("*, responsible:users!inventory_tracks_responsible_user_id_fkey(id, full_name)")
      .order("name")
      .returns<(InventoryTrack & { responsible: { id: string; full_name: string } | null })[]>(),
  ]);

  const stats = (statsRows as ProjectTaskStats[] | null)?.[0] ?? {
    total_count: 0,
    completed_count: 0,
    in_progress_count: 0,
    overdue_count: 0,
    completion_rate: 0,
  };

  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const nonMembers = (employees ?? []).filter((e) => !memberIds.has(e.id));
  const activeTasks = (tasks ?? []).filter((t) => t.status !== "cancelled");

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: attachments } = taskIds.length
    ? await supabase
        .from("task_attachments")
        .select("id, task_id, file_url, file_name, uploaded_at")
        .in("task_id", taskIds)
        .order("uploaded_at", { ascending: false })
    : { data: [] };

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from("task-attachments")
        .createSignedUrl(attachment.file_url, 60 * 60);
      return { ...attachment, signedUrl: data?.signedUrl ?? null };
    })
  );

  const inventoryTracks = inventoryTracksRaw ?? [];
  const linkedTracks = inventoryTracks.filter((t) => t.project_id === id);
  const availableTracks = inventoryTracks.filter((t) => t.project_id !== id);

  const todayIso = new Date().toISOString().slice(0, 10);
  const inventoryToolsByTrack = new Map<string, InventoryTool[]>();
  const inventoryChecksByTrack = new Map<string, InventoryDailyCheck[]>();

  if (linkedTracks.length > 0) {
    const { data: toolsData } = await supabase
      .from("inventory_tools")
      .select("*")
      .in(
        "track_id",
        linkedTracks.map((t) => t.id)
      )
      .order("position")
      .returns<InventoryTool[]>();
    const allTools = toolsData ?? [];
    for (const track of linkedTracks) {
      inventoryToolsByTrack.set(track.id, allTools.filter((tool) => tool.track_id === track.id));
    }

    if (allTools.length > 0) {
      const { data: checksData } = await supabase
        .from("inventory_daily_checks")
        .select("*")
        .eq("check_date", todayIso)
        .in(
          "tool_id",
          allTools.map((t) => t.id)
        )
        .returns<InventoryDailyCheck[]>();
      const allChecks = checksData ?? [];
      for (const track of linkedTracks) {
        const toolIds = new Set((inventoryToolsByTrack.get(track.id) ?? []).map((t) => t.id));
        inventoryChecksByTrack.set(track.id, allChecks.filter((c) => toolIds.has(c.tool_id)));
      }
    }
  }

  const panels: Record<ProjectTabKey, React.ReactNode> = {
    overview: (
      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4.5">
          <div className="rounded-[18px] border border-border bg-surface p-6">
            <p className="text-sm text-foreground">{project.description || "لا يوجد وصف"}</p>
          </div>
          {canManageProject && (
            <ProjectForm
              project={project}
              employees={employees ?? []}
              departments={departments ?? []}
              isSuperAdmin={profile.role === "super_admin"}
            />
          )}
        </div>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="إجمالي المهام" value={stats.total_count} />
            <StatTile label="المكتملة" value={stats.completed_count} tone="text-green-600" />
            <StatTile label="قيد التنفيذ" value={stats.in_progress_count} tone="text-accent-600" />
            <StatTile label="المتأخرة" value={stats.overdue_count} tone="text-brand-red-500" />
          </div>
          <div className="rounded-[18px] border border-border bg-surface p-5">
            <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold text-foreground">
              <span>نسبة الإنجاز</span>
              <span>{stats.completion_rate}٪</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${stats.completion_rate}%` }}
              />
            </div>
          </div>
          <div className="space-y-2 rounded-[18px] border border-border bg-surface p-5 text-[13px]">
            <div className="flex items-center justify-between text-muted">
              <span className="flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> مدير المشروع
              </span>
              <span className="font-bold text-foreground">{project.manager?.full_name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> الموعد النهائي
              </span>
              <span className="font-bold text-foreground">{project.due_date ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>القسم</span>
              <span className="font-bold text-foreground">{project.department?.name ?? "على مستوى المؤسسة"}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>الأعضاء</span>
              <span className="font-bold text-foreground">{members?.length ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    tasks: <TaskList tasks={tasks ?? []} canDelete={profile.role === "super_admin"} />,
    kanban: (
      <KanbanBoard tasks={activeTasks} canManage={canManageProject} currentUserId={profile.id} />
    ),
    milestones: (
      <ProjectMilestones
        projectId={project.id}
        milestones={milestones ?? []}
        canManage={canManageProject}
      />
    ),
    team: (
      <ProjectTeam
        projectId={project.id}
        members={members ?? []}
        employees={nonMembers}
        canManage={canManageProject}
      />
    ),
    inventory: (
      <div className="space-y-4.5">
        {profile.role === "super_admin" && (
          <InventoryProjectLinker projectId={project.id} availableTracks={availableTracks} />
        )}
        {linkedTracks.length === 0 ? (
          <div className="rounded-[18px] border border-border bg-surface p-10 text-center text-muted">
            لا يوجد مسار جرد مرتبط بهذا المشروع بعد
          </div>
        ) : (
          <InventoryTrackTabs
            tracks={linkedTracks}
            toolsByTrack={Object.fromEntries(inventoryToolsByTrack)}
            checksByTrack={Object.fromEntries(inventoryChecksByTrack)}
            todayIso={todayIso}
            isSuperAdmin={profile.role === "super_admin"}
            currentUserId={profile.id}
            employees={(employees ?? []).map((e) => ({ id: e.id, full_name: e.full_name }))}
          />
        )}
      </div>
    ),
    files: (
      <ul className="space-y-2">
        {attachmentsWithUrls.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3 text-sm"
          >
            {attachment.signedUrl ? (
              <a
                href={attachment.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-accent-600 hover:underline"
              >
                <DownloadIcon className="h-4 w-4" />
                {attachment.file_name}
              </a>
            ) : (
              <span className="text-muted">{attachment.file_name}</span>
            )}
            <span className="text-[12px] text-muted">
              {new Date(attachment.uploaded_at).toLocaleDateString("ar")}
            </span>
          </li>
        ))}
        {attachmentsWithUrls.length === 0 && (
          <li className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted">
            لا توجد ملفات في مهام هذا المشروع
          </li>
        )}
      </ul>
    ),
    activity: (
      <ul className="space-y-2">
        {(activity ?? []).map((entry) => (
          <li key={entry.id} className="rounded-[14px] border border-border bg-surface px-4 py-3 text-sm">
            <p className="text-foreground">{entry.description ?? entry.action_type}</p>
            <p className="mt-1 text-[12px] text-muted">
              {new Date(entry.created_at).toLocaleString("ar")}
            </p>
          </li>
        ))}
        {(activity ?? []).length === 0 && (
          <li className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted">
            لا يوجد نشاط مسجل بعد
          </li>
        )}
      </ul>
    ),
  };

  const projectSubtitle = [
    project.department?.name ? `قسم ${project.department.name}` : null,
    project.manager?.full_name ? `المدير: ${project.manager.full_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4.5">
      <Link
        href="/dashboard/projects"
        className="inline-block text-[12.5px] font-bold text-accent-600 hover:underline"
      >
        ← المشاريع
      </Link>

      <PageHeader
        title={project.name}
        subtitle={projectSubtitle || undefined}
        variant="violet"
        icon={<BriefcaseIcon className="h-6 w-6" />}
      >
        <HeaderChip>{PROJECT_STATUS_LABEL[project.status]}</HeaderChip>
        <HeaderChip>{PRIORITY_LABEL[project.priority]}</HeaderChip>
      </PageHeader>

      <ProjectTabs panels={panels} />
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <div className={`font-display text-[22px] ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11.5px] text-muted">{label}</div>
    </div>
  );
}
