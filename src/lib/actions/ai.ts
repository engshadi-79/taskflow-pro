"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type AiActionState = { error?: string };

const MANAGE_ROLES = ["super_admin", "department_manager"];

type ReassignPayload = { task_id: string; new_assignee_id: string; reason: string | null };
type CreateSubtasksPayload = { task_id: string; subtasks: { title: string; assigned_to: string }[] };
type CreateTaskPayload = {
  title: string;
  description: string | null;
  assigned_to: string;
  priority: string;
  due_date: string | null;
};

/**
 * The AI never mutates tasks itself (see src/lib/ai/tools.ts) - it only
 * inserts a pending row in ai_suggested_actions. This is where that
 * suggestion, once a human clicks [تأكيد], actually becomes a real write -
 * through the exact same MANAGE_ROLES check src/lib/actions/tasks.ts uses
 * for updateTask/createSubtask, not a separate AI-only permission path.
 */
export async function confirmAiAction(actionId: string): Promise<AiActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: action, error: fetchError } = await supabase
    .from("ai_suggested_actions")
    .select("id, action_type, target_id, payload, status")
    .eq("id", actionId)
    .single();

  if (fetchError || !action) return { error: "الاقتراح غير موجود" };
  if (action.status !== "pending") return { error: "تم التعامل مع هذا الاقتراح مسبقًا" };

  if (!MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بتنفيذ هذا الإجراء" };
  }

  if (action.action_type === "reassign_task") {
    const payload = action.payload as ReassignPayload;
    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: payload.new_assignee_id })
      .eq("id", payload.task_id);
    if (error) return { error: error.message || "تعذر تنفيذ نقل المهمة" };
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${payload.task_id}`);
  } else if (action.action_type === "create_subtasks") {
    const payload = action.payload as CreateSubtasksPayload;
    const { error } = await supabase.from("tasks").insert(
      payload.subtasks.map((s) => ({
        organization_id: profile.organization_id,
        title: s.title,
        assigned_to: s.assigned_to,
        created_by: profile.id,
        parent_task_id: payload.task_id,
      }))
    );
    if (error) return { error: error.message || "تعذر إنشاء المهام الفرعية" };
    revalidatePath(`/dashboard/tasks/${payload.task_id}`);
  } else if (action.action_type === "create_task") {
    const payload = action.payload as CreateTaskPayload;
    const { error } = await supabase.from("tasks").insert({
      organization_id: profile.organization_id,
      title: payload.title,
      description: payload.description ?? null,
      assigned_to: payload.assigned_to,
      created_by: profile.id,
      priority: payload.priority ?? "medium",
      due_date: payload.due_date ?? null,
    });
    if (error) return { error: error.message || "تعذر إنشاء المهمة" };
    revalidatePath("/dashboard/tasks");
  } else {
    return { error: "نوع إجراء غير معروف" };
  }

  await supabase
    .from("ai_suggested_actions")
    .update({ status: "confirmed", resolved_by: profile.id, resolved_at: new Date().toISOString() })
    .eq("id", actionId);

  return {};
}

export async function rejectAiAction(actionId: string): Promise<AiActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_suggested_actions")
    .update({ status: "rejected", resolved_by: profile.id, resolved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("status", "pending");

  if (error) return { error: "تعذر رفض الاقتراح" };
  return {};
}
