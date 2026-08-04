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
  created_at: string;
  updated_at: string;
};

export type TaskWithAssignee = Task & {
  assignee: { id: string; full_name: string } | null;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
};

export type TaskCommentWithAuthor = TaskComment & {
  author: { id: string; full_name: string } | null;
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
