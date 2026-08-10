"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { MeetingStatus } from "@/lib/types/meeting";

export type MeetingFormState = { error?: string };

const MANAGE_ROLES = ["super_admin", "department_manager"];

export async function createMeeting(
  _prevState: MeetingFormState,
  formData: FormData
): Promise<MeetingFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بإنشاء اجتماعات" };
  }

  const title = (formData.get("title") as string)?.trim();
  const meetingDate = formData.get("meeting_date") as string;
  const meetingTime = (formData.get("meeting_time") as string) || null;
  const location = (formData.get("location") as string)?.trim() || null;
  const projectId = (formData.get("project_id") as string) || null;
  const attendeeIds = formData.getAll("attendee_ids") as string[];

  if (!title) return { error: "عنوان الاجتماع مطلوب" };
  if (!meetingDate) return { error: "تاريخ الاجتماع مطلوب" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      organization_id: profile.organization_id,
      organizer_id: profile.id,
      title,
      meeting_date: meetingDate,
      meeting_time: meetingTime,
      location,
      project_id: projectId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "تعذر إنشاء الاجتماع" };

  if (attendeeIds.length > 0) {
    await supabase
      .from("meeting_attendees")
      .insert(attendeeIds.map((userId) => ({ meeting_id: data.id, user_id: userId })));

    // invite notification for every attendee added at creation time - the
    // 1-day/1-hour reminders (send_meeting_reminders(), meeting_fixes.sql)
    // are a separate, cron-driven concern for as the meeting gets close
    await supabase.from("notifications").insert(
      attendeeIds.map((userId) => ({
        user_id: userId,
        meeting_id: data.id,
        type: "meeting_invited",
        message: `تمت دعوتك إلى اجتماع "${title}" بتاريخ ${meetingDate}`,
      }))
    );
  }

  revalidatePath("/dashboard/meetings");
  redirect(`/dashboard/meetings/${data.id}`);
}

export async function updateMeetingStatus(id: string, status: MeetingStatus): Promise<MeetingFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ status }).eq("id", id);

  revalidatePath("/dashboard/meetings");
  revalidatePath(`/dashboard/meetings/${id}`);
  return error ? { error: "تعذر تحديث حالة الاجتماع" } : {};
}

export async function deleteMeeting(id: string): Promise<MeetingFormState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بحذف الاجتماعات" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", id);

  revalidatePath("/dashboard/meetings");
  return error ? { error: "تعذر حذف الاجتماع" } : {};
}

export async function addMeetingAttendee(meetingId: string, userId: string): Promise<MeetingFormState> {
  if (!userId) return { error: "اختر موظفًا" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_attendees")
    .insert({ meeting_id: meetingId, user_id: userId });

  if (error) return { error: "تعذر إضافة الحضور (قد يكون مضافًا مسبقًا)" };

  const { data: meeting } = await supabase
    .from("meetings")
    .select("title, meeting_date")
    .eq("id", meetingId)
    .single();
  if (meeting) {
    await supabase.from("notifications").insert({
      user_id: userId,
      meeting_id: meetingId,
      type: "meeting_invited",
      message: `تمت دعوتك إلى اجتماع "${meeting.title}" بتاريخ ${meeting.meeting_date}`,
    });
  }

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return {};
}

export async function removeMeetingAttendee(id: string, meetingId: string): Promise<MeetingFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_attendees").delete().eq("id", id);

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: "تعذر إزالة الحضور" } : {};
}

export async function addAgendaItem(
  _prevState: MeetingFormState,
  formData: FormData
): Promise<MeetingFormState> {
  const meetingId = formData.get("meeting_id") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!content) return { error: "اكتب نص البند" };

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_agenda_items").insert({ meeting_id: meetingId, content });

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: "تعذر إضافة البند" } : {};
}

export async function deleteAgendaItem(id: string, meetingId: string): Promise<MeetingFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_agenda_items").delete().eq("id", id);

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: "تعذر حذف البند" } : {};
}

export async function addMinuteItem(
  _prevState: MeetingFormState,
  formData: FormData
): Promise<MeetingFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const meetingId = formData.get("meeting_id") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!content) return { error: "اكتب نص البند" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_minutes_items")
    .insert({ meeting_id: meetingId, content, created_by: profile.id });

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: "تعذر إضافة البند" } : {};
}

export async function deleteMinuteItem(id: string, meetingId: string): Promise<MeetingFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_minutes_items").delete().eq("id", id);

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: "تعذر حذف البند" } : {};
}

export async function convertMinuteToTask(
  minuteId: string,
  meetingId: string,
  assignedTo: string,
  dueDate: string | null,
  priority: string
): Promise<MeetingFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_minute_to_task", {
    p_minute_id: minuteId,
    p_assigned_to: assignedTo,
    p_due_date: dueDate,
    p_priority: priority,
  });

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return error ? { error: error.message || "تعذر تحويل البند إلى مهمة" } : {};
}

export async function uploadMeetingAttachment(
  _prevState: MeetingFormState,
  formData: FormData
): Promise<MeetingFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const meetingId = formData.get("meeting_id") as string;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "اختر ملفًا للرفع" };

  const supabase = await createClient();
  const path = `meetings/${meetingId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("task-attachments").upload(path, file);
  if (uploadError) return { error: "تعذر رفع الملف" };

  const { error: insertError } = await supabase.from("meeting_attachments").insert({
    meeting_id: meetingId,
    uploaded_by: profile.id,
    file_url: path,
    file_name: file.name,
    file_type: file.type || null,
  });

  if (insertError) {
    await supabase.storage.from("task-attachments").remove([path]);
    return { error: "تعذر حفظ بيانات المرفق" };
  }

  revalidatePath(`/dashboard/meetings/${meetingId}`);
  return {};
}

export async function deleteMeetingAttachment(id: string, meetingId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("task-attachments").remove([filePath]);
  await supabase.from("meeting_attachments").delete().eq("id", id);
  revalidatePath(`/dashboard/meetings/${meetingId}`);
}
