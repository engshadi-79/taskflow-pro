"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type TimeEntryFormState = { error?: string };

/**
 * "Start" and "Resume" are the same action - each run is its own row
 * (started_at/ended_at), so resuming after a pause just opens a new row for
 * the same task. task_time_entries_no_overlap (time_tracking.sql) is what
 * actually stops a user from having two sessions open at once, on this task
 * or any other - this only turns that DB error into a readable message.
 */
export async function startTimer(taskId: string): Promise<TimeEntryFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_time_entries").insert({
    task_id: taskId,
    user_id: profile.id,
    started_at: new Date().toISOString(),
  });

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "لديك جلسة توقيت مفتوحة بالفعل على مهمة أخرى - أوقفها أولًا"
          : "تعذر بدء التوقيت",
    };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function stopTimer(entryId: string, taskId: string): Promise<TimeEntryFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entryId)
    .is("ended_at", null);

  if (error) return { error: "تعذر إيقاف التوقيت" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function updateTimeEntryNote(
  entryId: string,
  taskId: string,
  note: string
): Promise<TimeEntryFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_time_entries")
    .update({ note: note.trim() || null })
    .eq("id", entryId);

  if (error) return { error: "تعذر حفظ الملاحظة" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}

export async function deleteTimeEntry(entryId: string, taskId: string): Promise<TimeEntryFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_time_entries").delete().eq("id", entryId);

  if (error) return { error: "تعذر حذف الجلسة" };

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return {};
}
