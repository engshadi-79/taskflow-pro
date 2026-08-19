import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileTaskTimer } from "@/components/mobile/mobile-task-timer";
import { MobileTaskChecklist } from "@/components/mobile/mobile-task-checklist";
import { MobileTaskComments } from "@/components/mobile/mobile-task-comments";
import { MobileSubmitForReview, MobileReviewPanel } from "@/components/mobile/mobile-review-actions";
import { MOBILE_GRADIENT_PRIMARY, MOBILE_STATUS_STYLE } from "@/lib/mobile-theme";
import { PRIORITY_LABEL, STATUS_LABEL, type Task, type TaskCommentWithAuthor } from "@/lib/types/task";
import type { TaskChecklistItem } from "@/lib/types/project";

export default async function MobileTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [{ data: task }, { data: commentsRaw }, { data: checklistItems }, { data: myOpenEntryRows }, { data: summaryRows }] =
    await Promise.all([
      supabase.from("tasks").select("*, assignee:users!tasks_assigned_to_fkey(id, full_name)").eq("id", id).single(),
      supabase.rpc("task_comments_with_authors", { p_task_id: id }),
      supabase.from("task_checklists").select("*").eq("task_id", id).order("created_at", { ascending: true }).returns<TaskChecklistItem[]>(),
      supabase.from("task_time_entries").select("id, task_id").eq("user_id", profile.id).is("ended_at", null).limit(1),
      supabase.rpc("task_time_summary", { p_task_id: id }),
    ]);

  if (!task) {
    notFound();
  }

  const taskTyped = task as Task & { assignee: { id: string; full_name: string } | null };
  const comments = (commentsRaw as unknown as TaskCommentWithAuthor[] | null) ?? [];
  const myOpenEntry = (myOpenEntryRows as { id: string; task_id: string }[] | null)?.[0] ?? null;
  const summary = (summaryRows as { actual_seconds: number; has_running: boolean }[] | null)?.[0] ?? {
    actual_seconds: 0,
    has_running: false,
  };
  const canManage = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <MobileHeader
        back
        gradient={MOBILE_GRADIENT_PRIMARY}
        subtitle="تفاصيل المهمة"
        title={taskTyped.title}
        chips={
          <>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${MOBILE_STATUS_STYLE[taskTyped.status].badge}`}>
              {STATUS_LABEL[taskTyped.status]}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold text-white">
              أولوية {PRIORITY_LABEL[taskTyped.priority]}
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-4.5 p-4">
        <div className="flex gap-4 text-[12px] font-semibold text-muted">
          <span>
            المسؤول: <b className="text-foreground">{taskTyped.assignee?.full_name ?? "—"}</b>
          </span>
          <span>
            الموعد: <b className="text-foreground">{taskTyped.due_date ?? "—"}</b>
          </span>
        </div>

        {taskTyped.description && <p className="text-[13px] leading-8 text-muted">{taskTyped.description}</p>}

        {profile.id === taskTyped.assigned_to && ["new", "in_progress"].includes(taskTyped.status) && (
          <MobileSubmitForReview taskId={taskTyped.id} />
        )}

        {canManage && taskTyped.status === "pending_review" && <MobileReviewPanel taskId={taskTyped.id} />}

        <MobileTaskTimer
          taskId={taskTyped.id}
          actualSeconds={summary.actual_seconds}
          hasRunning={summary.has_running}
          myOpenEntry={myOpenEntry}
        />

        <MobileTaskChecklist taskId={taskTyped.id} items={checklistItems ?? []} />

        <MobileTaskComments taskId={taskTyped.id} comments={comments} />
      </div>
    </div>
  );
}
