"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type NoteFormState = { error?: string };

const MAX_NOTE_LENGTH = 500;

export async function addPersonalNote(
  _prevState: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const content = (formData.get("content") as string)?.trim();
  if (!content) return { error: "اكتب ملاحظة قبل الإضافة" };
  if (content.length > MAX_NOTE_LENGTH) {
    return { error: `الملاحظة يجب ألا تتجاوز ${MAX_NOTE_LENGTH} حرفًا` };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("personal_notes").insert({ user_id: profile.id, content });
  if (error) return { error: "تعذر إضافة الملاحظة" };

  revalidatePath("/dashboard", "layout");
  return {};
}

export async function deletePersonalNote(id: string) {
  const supabase = await createClient();
  await supabase.from("personal_notes").delete().eq("id", id);
  revalidatePath("/dashboard", "layout");
}
