"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { DependencyType } from "@/lib/types/project";

export type DependencyFormState = { error?: string };

export async function addDependency(
  _prevState: DependencyFormState,
  formData: FormData
): Promise<DependencyFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const taskId = formData.get("task_id") as string;
  const dependsOnTaskId = formData.get("depends_on_task_id") as string;
  const dependencyType = formData.get("dependency_type") as DependencyType;

  if (!dependsOnTaskId) return { error: "اختر المهمة التي تعتمد عليها" };
  if (taskId === dependsOnTaskId) return { error: "لا يمكن أن تعتمد المهمة على نفسها" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").insert({
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
    dependency_type: dependencyType || "finish_to_start",
  });

  if (error) {
    // surfaces the trigger's own message (self-reference/cycle/cross-org) -
    // see task_dependencies_rules.sql and the check constraint in
    // projects_foundation.sql - instead of a generic failure
    return { error: error.message || "تعذر إضافة التبعية" };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function removeDependency(
  id: string,
  taskId: string
): Promise<DependencyFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").delete().eq("id", id);

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return error ? { error: "تعذر حذف التبعية" } : {};
}
