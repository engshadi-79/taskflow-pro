"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type ChatActionState = { error?: string; id?: string };

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
  // voice messages recorded via MediaRecorder - browsers vary in which of
  // these they actually produce (Chrome/Firefox default to audio/webm,
  // Safari to audio/mp4), so all four are allowed rather than picking one
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
];

export async function startDirectConversation(otherUserId: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_conversation", {
    p_type: "direct",
    p_name: null,
    p_participant_ids: [otherUserId],
  });

  if (error || !data) return { error: error?.message || "تعذر بدء المحادثة" };

  revalidatePath("/dashboard/chat");
  return { id: data as string };
}

export async function startGroupConversation(name: string, participantIds: string[]): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };
  if (!name.trim()) return { error: "اسم المجموعة مطلوب" };
  if (participantIds.length < 1) return { error: "اختر عضوًا واحدًا على الأقل" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_conversation", {
    p_type: "group",
    p_name: name.trim(),
    p_participant_ids: participantIds,
  });

  if (error || !data) return { error: error?.message || "تعذر إنشاء المجموعة" };

  revalidatePath("/dashboard/chat");
  return { id: data as string };
}

export async function renameGroupConversation(conversationId: string, name: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_conversation", {
    p_conversation_id: conversationId,
    p_name: name,
  });

  if (error) return { error: error.message || "تعذر تعديل الاسم" };

  revalidatePath("/dashboard/chat");
  return {};
}

export async function addConversationMembers(conversationId: string, userIds: string[]): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_conversation_participants", {
    p_conversation_id: conversationId,
    p_user_ids: userIds,
  });

  if (error) return { error: error.message || "تعذر إضافة الأعضاء" };

  revalidatePath("/dashboard/chat");
  return {};
}

export async function leaveConversation(conversationId: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_conversation", { p_conversation_id: conversationId });

  if (error) return { error: "تعذر مغادرة المحادثة" };

  revalidatePath("/dashboard/chat");
  return {};
}

/**
 * The one plain self-row write in this whole feature - RLS
 * (conversation_participants_update_own) allows it directly, no RPC needed.
 */
export async function markConversationRead(conversationId: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", profile.id);

  return error ? { error: "تعذر التحديث" } : {};
}

/**
 * Handles a plain text message, an attachment-only message, or both in one
 * round trip - the message row always gets created first (attachments FK
 * to a message_id, so there's no other order), the file upload is
 * best-effort after that: a failed/oversized/unsupported file never loses
 * the text that was already sent alongside it.
 */
export async function sendChatMessage(
  conversationId: string,
  content: string,
  file?: File | null
): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const trimmed = content.trim();
  const hasFile = !!file && file.size > 0;
  if (!trimmed && !hasFile) return { error: "الرسالة فارغة" };

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: conversationId, sender_id: profile.id, content: trimmed || null })
    .select("id")
    .single();

  if (error || !message) return { error: error?.message || "تعذر إرسال الرسالة" };

  if (hasFile && file) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { id: message.id, error: "حجم الملف يجب ألا يتجاوز 20 ميجابايت" };
    }
    if (file.type && !ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return { id: message.id, error: "نوع الملف غير مدعوم" };
    }

    // storage object keys must stay ASCII-safe (Arabic/unicode filenames -
    // e.g. a voice message named "رسالة-صوتية...") broke the upload; the
    // original name is preserved separately in file_name for display
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `chat/${conversationId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("task-attachments").upload(path, file);
    if (uploadError) {
      return { id: message.id, error: `تعذر رفع الملف: ${uploadError.message}` };
    }

    const { error: attachError } = await supabase.from("chat_message_attachments").insert({
      message_id: message.id,
      file_url: path,
      file_name: file.name,
      file_type: file.type || null,
    });
    if (attachError) {
      await supabase.storage.from("task-attachments").remove([path]);
      return { id: message.id, error: `تعذر حفظ المرفق: ${attachError.message}` };
    }
  }

  return { id: message.id };
}

export async function editChatMessage(messageId: string, content: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };
  if (!content.trim()) return { error: "الرسالة فارغة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_messages")
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", profile.id);

  return error ? { error: "تعذر تعديل الرسالة" } : {};
}

export async function deleteChatMessage(messageId: string): Promise<ChatActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_messages")
    .update({ content: null, deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", profile.id);

  return error ? { error: "تعذر حذف الرسالة" } : {};
}
