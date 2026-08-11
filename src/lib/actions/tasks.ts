"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { Priority, RecurrencePattern, TaskStatus } from "@/lib/types/task";

export type TaskFormState = { error?: string };

const MANAGE_ROLES = ["super_admin", "department_manager"];

function parseTaskFields(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const assignedTo = formData.get("assigned_to") as string;
  const priority = formData.get("priority") as Priority;
  const status = formData.get("status") as TaskStatus;
  const startDate = (formData.get("start_date") as string) || null;
  const startTime = (formData.get("start_time") as string) || null;
  const dueDate = (formData.get("due_date") as string) || null;
  const dueTime = (formData.get("due_time") as string) || null;
  const isRecurring = formData.get("is_recurring") === "on";
  const recurrencePattern = isRecurring
    ? ((formData.get("recurrence_pattern") as RecurrencePattern) || null)
    : null;
  const projectId = (formData.get("project_id") as string) || null;
  // a milestone only makes sense alongside its own project - the
  // tasks_enforce_milestone_project_match trigger (projects_foundation.sql)
  // rejects the write server-side too if these ever disagree
  const milestoneId = projectId ? (formData.get("milestone_id") as string) || null : null;
  const estimatedHoursRaw = (formData.get("estimated_hours") as string)?.trim();
  const estimatedHours = estimatedHoursRaw ? Number(estimatedHoursRaw) : null;

  return {
    title,
    description,
    assignedTo,
    priority,
    status,
    startDate,
    startTime,
    dueDate,
    dueTime,
    isRecurring,
    recurrencePattern,
    projectId,
    milestoneId,
    estimatedHours,
  };
}

export async function createTask(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بإنشاء المهام" };
  }

  const fields = parseTaskFields(formData);

  if (!fields.title) return { error: "عنوان المهمة مطلوب" };
  if (!fields.assignedTo) return { error: "اختر الموظف المسند إليه المهمة" };
  if (fields.isRecurring && !fields.recurrencePattern) {
    return { error: "اختر نمط التكرار للمهمة المتكررة" };
  }
  if (fields.estimatedHours !== null && (Number.isNaN(fields.estimatedHours) || fields.estimatedHours < 0)) {
    return { error: "الوقت المخطط يجب أن يكون رقمًا صحيحًا موجبًا" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: profile.organization_id,
      title: fields.title,
      description: fields.description,
      assigned_to: fields.assignedTo,
      created_by: profile.id,
      priority: fields.priority,
      status: fields.status,
      start_date: fields.startDate,
      start_time: fields.startTime,
      due_date: fields.dueDate,
      due_time: fields.dueTime,
      is_recurring: fields.isRecurring,
      recurrence_pattern: fields.recurrencePattern,
      project_id: fields.projectId,
      milestone_id: fields.milestoneId,
      estimated_hours: fields.estimatedHours,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "تعذر إنشاء المهمة" };
  }

  revalidatePath("/dashboard/tasks");
  redirect(`/dashboard/tasks/${data.id}`);
}

export async function updateTask(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بتعديل المهام" };
  }

  const id = formData.get("id") as string;
  const fields = parseTaskFields(formData);

  if (!fields.title) return { error: "عنوان المهمة مطلوب" };
  if (!fields.assignedTo) return { error: "اختر الموظف المسند إليه المهمة" };
  if (fields.isRecurring && !fields.recurrencePattern) {
    return { error: "اختر نمط التكرار للمهمة المتكررة" };
  }
  if (fields.estimatedHours !== null && (Number.isNaN(fields.estimatedHours) || fields.estimatedHours < 0)) {
    return { error: "الوقت المخطط يجب أن يكون رقمًا صحيحًا موجبًا" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: fields.title,
      description: fields.description,
      assigned_to: fields.assignedTo,
      priority: fields.priority,
      status: fields.status,
      start_date: fields.startDate,
      start_time: fields.startTime,
      due_date: fields.dueDate,
      due_time: fields.dueTime,
      is_recurring: fields.isRecurring,
      recurrence_pattern: fields.recurrencePattern,
      project_id: fields.projectId,
      milestone_id: fields.milestoneId,
      estimated_hours: fields.estimatedHours,
    })
    .eq("id", id);

  if (error) {
    // surfaces tasks_enforce_dependency_gate's own message (see
    // task_dependencies_rules.sql) instead of a generic failure, when this
    // update is what triggered it
    return { error: error.message || "تعذر تحديث المهمة" };
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${id}`);
  return {};
}

export async function deleteTask(id: string, parentTaskId?: string): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بحذف المهام" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return { error: "تعذر حذف المهمة" };
  }

  revalidatePath("/dashboard/tasks");
  // deleting a subtask needs its parent's own page refreshed too - the
  // parent isn't touched by the row deleted above, so it wouldn't
  // otherwise re-fetch
  if (parentTaskId) revalidatePath(`/dashboard/tasks/${parentTaskId}`);
  return {};
}

/**
 * A subtask is a plain row in the same tasks table (see subtasks.sql) with
 * parent_task_id set - deliberately not a full TaskForm submission, since a
 * quick subtask only needs a title and an assignee; project_id/milestone_id
 * are overwritten server-side by enforce_subtask_rules() regardless of what
 * gets sent here, and priority/status just take the table's own defaults.
 */
export async function createSubtask(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بإضافة مهام فرعية" };
  }

  const parentTaskId = formData.get("parent_task_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const assignedTo = formData.get("assigned_to") as string;

  if (!title) return { error: "عنوان المهمة الفرعية مطلوب" };
  if (!assignedTo) return { error: "اختر الموظف المسند إليه" };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    organization_id: profile.organization_id,
    title,
    assigned_to: assignedTo,
    created_by: profile.id,
    parent_task_id: parentTaskId,
  });

  if (error) return { error: "تعذر إضافة المهمة الفرعية" };

  revalidatePath(`/dashboard/tasks/${parentTaskId}`);
  return {};
}

/**
 * Calendar drag-and-drop reschedule - a Server Action, not a client-only UI
 * update, per Prompt 11 ("يجب أن يمر تغيير الموعد عبر Server Action/API").
 * Same permission shape as moveTaskStatus: managers can move anyone's task,
 * an assignee can only move their own.
 */
export async function rescheduleTask(taskId: string, newDueDate: string): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, assigned_to")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "المهمة غير موجودة" };

  const canManage = MANAGE_ROLES.includes(profile.role);
  if (!canManage && task.assigned_to !== profile.id) {
    return { error: "غير مصرح لك بتحديث هذه المهمة" };
  }

  const { error } = await supabase.from("tasks").update({ due_date: newDueDate }).eq("id", taskId);
  if (error) return { error: error.message || "تعذر تحديث الموعد" };

  revalidatePath("/dashboard/calendar");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

const DRAG_ALLOWED_FOR_ASSIGNEE: TaskStatus[] = ["new", "in_progress", "pending_review"];

export async function moveTaskStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, assigned_to, status")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "المهمة غير موجودة" };

  const canManage = MANAGE_ROLES.includes(profile.role);
  const isAssignee = task.assigned_to === profile.id;

  if (!canManage) {
    if (!isAssignee) return { error: "غير مصرح لك بتحديث هذه المهمة" };
    if (!DRAG_ALLOWED_FOR_ASSIGNEE.includes(newStatus)) {
      return { error: "لا يمكنك نقل المهمة إلى هذه الحالة مباشرة" };
    }
  }

  const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
  if (error) return { error: error.message || "تعذر تحديث حالة المهمة" };

  revalidatePath("/dashboard/kanban");
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function submitForReview(taskId: string): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, assigned_to, status")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "المهمة غير موجودة" };
  if (task.assigned_to !== profile.id) {
    return { error: "لا يمكنك تحديث هذه المهمة" };
  }
  if (!["new", "in_progress"].includes(task.status)) {
    return { error: "لا يمكن إرسال هذه المهمة للمراجعة في حالتها الحالية" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "pending_review" })
    .eq("id", taskId);

  if (error) return { error: error.message || "تعذر تحديث حالة المهمة" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function reviewTask(
  taskId: string,
  decision: "approve" | "reject",
  notes: string
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بمراجعة المهام" };
  }

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "المهمة غير موجودة" };
  if (task.status !== "pending_review") {
    return { error: "هذه المهمة ليست بانتظار المراجعة" };
  }
  if (decision === "reject" && !notes.trim()) {
    return { error: "سبب الإرجاع مطلوب" };
  }

  const nextStatus = decision === "approve" ? "completed" : "in_progress";

  const { error } = await supabase
    .from("tasks")
    .update({ status: nextStatus })
    .eq("id", taskId);

  if (error) return { error: error.message || "تعذر تحديث حالة المهمة" };

  const trimmedNotes = notes.trim();
  if (trimmedNotes) {
    await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: profile.id,
      content: (decision === "approve" ? "تم الاعتماد: " : "تم الرفض: ") + trimmedNotes,
    });
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard/tasks");
  return {};
}

export async function addComment(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const taskId = formData.get("task_id") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!content) return { error: "اكتب تعليقًا قبل الإرسال" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: profile.id,
    content,
  });

  if (error) return { error: "تعذر إضافة التعليق" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function deleteComment(id: string, taskId: string) {
  const supabase = await createClient();
  await supabase.from("task_comments").delete().eq("id", id);
  revalidatePath(`/dashboard/tasks/${taskId}`);
}

export async function uploadAttachment(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const taskId = formData.get("task_id") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { error: "اختر ملفًا للرفع" };

  const supabase = await createClient();
  const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, file);

  if (uploadError) return { error: "تعذر رفع الملف" };

  const { error: insertError } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    uploaded_by: profile.id,
    file_url: path,
    file_name: file.name,
    file_type: file.type || null,
  });

  if (insertError) {
    await supabase.storage.from("task-attachments").remove([path]);
    return { error: "تعذر حفظ بيانات المرفق" };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function deleteAttachment(id: string, taskId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("task-attachments").remove([filePath]);
  await supabase.from("task_attachments").delete().eq("id", id);
  revalidatePath(`/dashboard/tasks/${taskId}`);
}
