export type MeetingStatus = "scheduled" | "completed" | "cancelled";

export type Meeting = {
  id: string;
  organization_id: string;
  project_id: string | null;
  organizer_id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
};

export type MeetingAttendee = {
  id: string;
  meeting_id: string;
  user_id: string;
  created_at: string;
};

export type MeetingAgendaItem = {
  id: string;
  meeting_id: string;
  position: number;
  content: string;
  created_at: string;
};

export type MeetingMinuteItem = {
  id: string;
  meeting_id: string;
  content: string;
  converted_task_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type MeetingAttachment = {
  id: string;
  meeting_id: string;
  uploaded_by: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_at: string;
};

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: "مجدوَل",
  completed: "منتهٍ",
  cancelled: "ملغى",
};
