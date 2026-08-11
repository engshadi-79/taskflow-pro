import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/dashboard/task-form";
import { CommentsSection } from "@/components/dashboard/comments-section";
import { AttachmentsSection } from "@/components/dashboard/attachments-section";
import { ChecklistSection } from "@/components/dashboard/checklist-section";
import { SubtasksSection } from "@/components/dashboard/subtasks-section";
import { DependenciesSection } from "@/components/dashboard/dependencies-section";
import { TimeTrackingSection } from "@/components/dashboard/time-tracking-section";
import { SlaSection } from "@/components/dashboard/sla-section";
import { DeleteTaskButton } from "@/components/dashboard/delete-task-button";
import { SubmitForReviewButton } from "@/components/dashboard/submit-for-review-button";
import { ReviewSection } from "@/components/dashboard/review-section";
import { TaskTimeline, type TaskTimelineEntry } from "@/components/dashboard/task-timeline";
import { updateTask } from "@/lib/actions/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Task,
  type TaskAttachment,
  type TaskCommentWithAuthor,
  type TaskStatus,
} from "@/lib/types/task";
import type { DependencyType, TaskChecklistItem } from "@/lib/types/project";
import type { TaskSla } from "@/lib/types/sla";

export default async function TaskDetailPage({
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

  const [
    { data: task },
    { data: comments },
    { data: attachments },
    { data: checklistItems },
    { data: subtasks },
    { data: dependsOn },
    { data: blocks },
    { data: timeEntries },
    { data: myOpenEntryRows },
    { data: summaryRows },
    { data: slaRows },
    { data: timelineRaw },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).single<Task>(),
    supabase
      .from("task_comments")
      .select("*, author:users!task_comments_user_id_fkey(id, full_name)")
      .eq("task_id", id)
      .order("created_at", { ascending: true })
      .returns<TaskCommentWithAuthor[]>(),
    supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", id)
      .order("uploaded_at", { ascending: true })
      .returns<TaskAttachment[]>(),
    supabase
      .from("task_checklists")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true })
      .returns<TaskChecklistItem[]>(),
    supabase
      .from("tasks")
      .select("id, title, status, assignee:users!tasks_assigned_to_fkey(full_name)")
      .eq("parent_task_id", id)
      .order("created_at", { ascending: true })
      .returns<{ id: string; title: string; status: TaskStatus; assignee: { full_name: string } | null }[]>(),
    supabase
      .from("task_dependencies")
      .select("id, dependency_type, task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)")
      .eq("task_id", id)
      .returns<{ id: string; dependency_type: DependencyType; task: { id: string; title: string; status: TaskStatus } }[]>(),
    supabase
      .from("task_dependencies")
      .select("id, dependency_type, task:tasks!task_dependencies_task_id_fkey(id, title, status)")
      .eq("depends_on_task_id", id)
      .returns<{ id: string; dependency_type: DependencyType; task: { id: string; title: string; status: TaskStatus } }[]>(),
    supabase
      .from("task_time_entries")
      .select("id, user_id, started_at, ended_at, duration_seconds, note, user:users(full_name)")
      .eq("task_id", id)
      .order("started_at", { ascending: false })
      .returns<
        {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          note: string | null;
          user: { full_name: string } | null;
        }[]
      >(),
    supabase
      .from("task_time_entries")
      .select("id, task_id")
      .eq("user_id", profile.id)
      .is("ended_at", null)
      .limit(1),
    supabase.rpc("task_time_summary", { p_task_id: id }),
    supabase.rpc("task_sla", { p_task_id: id }),
    supabase
      .from("activity_log")
      .select("id, action_type, description, created_at, user:users(full_name)")
      .eq("entity_type", "task")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .returns<TaskTimelineEntry[]>(),
  ]);

  if (!task) {
    notFound();
  }

  const sla = (slaRows as TaskSla[] | null)?.[0] ?? null;
  const myOpenEntry = myOpenEntryRows?.[0] ?? null;
  const summary = (summaryRows as { actual_seconds: number; has_running: boolean }[] | null)?.[0] ?? {
    actual_seconds: 0,
    has_running: false,
  };

  const parentTask = task.parent_task_id
    ? (await supabase.from("tasks").select("id, title").eq("id", task.parent_task_id).single()).data
    : null;

  const canManage = profile.role === "super_admin" || profile.role === "department_manager";

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from("task-attachments")
        .createSignedUrl(attachment.file_url, 60 * 60);
      return { ...attachment, signedUrl: data?.signedUrl ?? null };
    })
  );

  let employees: { id: string; full_name: string }[] = [];
  let projects: { id: string; name: string; milestones: { id: string; title: string }[] }[] = [];
  let otherTasks: { id: string; title: string }[] = [];
  if (canManage) {
    const [{ data: employeeData }, { data: projectData }, { data: taskData }] = await Promise.all([
      supabase.from("users").select("id, full_name").order("full_name"),
      supabase
        .from("projects")
        .select("id, name, milestones:project_milestones(id, title)")
        .order("name"),
      supabase.from("tasks").select("id, title").neq("id", id).order("title"),
    ]);
    employees = employeeData ?? [];
    projects = projectData ?? [];
    otherTasks = taskData ?? [];
  }

  return (
    <div className="max-w-3xl space-y-8">
      {parentTask && (
        <Link
          href={`/dashboard/tasks/${parentTask.id}`}
          className="inline-block text-[12.5px] font-bold text-accent-600 hover:underline"
        >
          ← جزء من: {parentTask.title}
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-[20px] text-foreground">{task.title}</h1>
        {profile.role === "super_admin" && (
          <DeleteTaskButton id={task.id} parentTaskId={task.parent_task_id ?? undefined} />
        )}
      </div>

      {canManage ? (
        <TaskForm
          key={task.updated_at}
          task={task}
          employees={employees}
          projects={projects}
          action={updateTask}
        />
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-6 text-sm">
          <p className="text-foreground">{task.description || "لا يوجد وصف"}</p>
          <div className="grid grid-cols-2 gap-3 text-muted sm:grid-cols-4">
            <div>
              <span className="block text-xs">الأولوية</span>
              {PRIORITY_LABEL[task.priority]}
            </div>
            <div>
              <span className="block text-xs">الحالة</span>
              {STATUS_LABEL[task.status]}
            </div>
            <div>
              <span className="block text-xs">تاريخ الاستحقاق</span>
              {task.due_date ?? "—"}
            </div>
            <div>
              <span className="block text-xs">وقت الاستحقاق</span>
              {task.due_time ?? "—"}
            </div>
          </div>
        </div>
      )}

      {profile.id === task.assigned_to && ["new", "in_progress"].includes(task.status) && (
        <SubmitForReviewButton taskId={task.id} />
      )}

      {canManage && task.status === "pending_review" && <ReviewSection taskId={task.id} />}

      <SlaSection sla={sla} />

      <DependenciesSection
        taskId={task.id}
        dependsOn={dependsOn ?? []}
        blocks={blocks ?? []}
        otherTasks={otherTasks}
        canManage={canManage}
      />

      <TimeTrackingSection
        taskId={task.id}
        entries={timeEntries ?? []}
        estimatedHours={task.estimated_hours}
        actualSeconds={summary.actual_seconds}
        hasRunning={summary.has_running}
        currentUserId={profile.id}
        myOpenEntry={myOpenEntry}
        canDeleteAny={profile.role === "super_admin"}
      />

      <ChecklistSection taskId={task.id} items={checklistItems ?? []} />

      {!task.parent_task_id && (
        <SubtasksSection
          parentTaskId={task.id}
          subtasks={subtasks ?? []}
          employees={employees}
          canManage={canManage}
          canDelete={profile.role === "super_admin"}
        />
      )}

      <AttachmentsSection
        taskId={task.id}
        attachments={attachmentsWithUrls}
        currentUserId={profile.id}
        canDeleteAny={profile.role === "super_admin"}
      />

      <CommentsSection
        taskId={task.id}
        comments={comments ?? []}
        currentUserId={profile.id}
        canDeleteAny={profile.role === "super_admin"}
      />

      <TaskTimeline entries={timelineRaw ?? []} />
    </div>
  );
}
