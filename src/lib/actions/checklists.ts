"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type ChecklistFormState = { error?: string };

export async function addChecklistItem(
  _prevState: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const taskId = formData.get("task_id") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!content) return { error: "اكتب نص الخطوة" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_checklists").insert({
    task_id: taskId,
    content,
    created_by: profile.id,
  });

  if (error) return { error: "تعذر إضافة الخطوة" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function toggleChecklistItem(
  id: string,
  taskId: string,
  isCompleted: boolean
): Promise<ChecklistFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklists")
    .update({ is_completed: isCompleted })
    .eq("id", id);

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return error ? { error: "تعذر تحديث الخطوة" } : {};
}

export async function deleteChecklistItem(
  id: string,
  taskId: string
): Promise<ChecklistFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklists").delete().eq("id", id);

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return error ? { error: "تعذر حذف الخطوة" } : {};
}
