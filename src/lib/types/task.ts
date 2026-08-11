export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus =
  | "new"
  | "in_progress"
  | "pending_review"
  | "completed"
  | "overdue"
  | "cancelled";
export type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

export type Task = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  created_by: string | null;
  priority: Priority;
  status: TaskStatus;
  start_date: string | null;
  start_time: string | null;
  due_date: string | null;
  due_time: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_interval: number;
  recurrence_days_of_week: number[] | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  recurring_root_id: string | null;
  occurrence_number: number;
  project_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  estimated_hours: number | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithAssignee = Task & {
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  version_number: number;
  original_attachment_id: string | null;
  uploaded_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string | null;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

/** Shape returned by the task_comments_with_authors() RPC - resolves
 * author names server-side (SECURITY DEFINER) since a plain employee can't
 * otherwise see another user's row under users_select RLS. */
export type TaskCommentWithAuthor = {
  id: string;
  parent_comment_id: string | null;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  mentioned_names: string[];
  attachments: { id: string; file_name: string; file_url: string; file_type: string | null }[];
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  pending_review: "بانتظار المراجعة",
  completed: "مكتملة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

export const RECURRENCE_LABEL: Record<RecurrencePattern, string> = {
  daily: "يوميًا",
  weekly: "أسبوعيًا",
  monthly: "شهريًا",
  yearly: "سنويًا",
};
