import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/dashboard/task-form";
import { CommentsSection } from "@/components/dashboard/comments-section";
import { AttachmentsSection } from "@/components/dashboard/attachments-section";
import { DeleteTaskButton } from "@/components/dashboard/delete-task-button";
import { SubmitForReviewButton } from "@/components/dashboard/submit-for-review-button";
import { ReviewSection } from "@/components/dashboard/review-section";
import { updateTask } from "@/lib/actions/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Task,
  type TaskAttachment,
  type TaskCommentWithAuthor,
} from "@/lib/types/task";

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

  const [{ data: task }, { data: comments }, { data: attachments }] = await Promise.all([
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
  ]);

  if (!task) {
    notFound();
  }

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
  if (canManage) {
    const { data } = await supabase.from("users").select("id, full_name").order("full_name");
    employees = data ?? [];
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[20px] text-foreground">{task.title}</h1>
        {profile.role === "super_admin" && <DeleteTaskButton id={task.id} />}
      </div>

      {canManage ? (
        <TaskForm key={task.updated_at} task={task} employees={employees} action={updateTask} />
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
    </div>
  );
}
