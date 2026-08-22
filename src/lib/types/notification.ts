export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  meeting_id: string | null;
  article_id: string | null;
  comment_id: string | null;
  admin_notification_id: string | null;
  conversation_id: string | null;
  type: string;
  title: string | null;
  message: string;
  is_read: boolean;
  read_at: string | null;
  suppress_realtime: boolean;
  created_at: string;
};

export type UserNotificationPreferences = {
  muted_types: string[];
  dnd_enabled: boolean;
  dnd_start_time: string;
  dnd_end_time: string;
  dnd_timezone: string;
  digest_mode: "off" | "daily";
  email_digest_enabled: boolean;
  weekly_report_email_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
};

export type NotificationCategory = {
  key: string;
  label: string;
  types: string[];
};

/**
 * Grouping only - purely a UI affordance. The DB trigger
 * (apply_notification_preferences) checks raw `type` values against
 * muted_types, with no concept of categories itself; toggling a category off
 * here just expands to all its underlying types before saving.
 * admin_announcement is deliberately not included - an org-wide broadcast
 * from a manager should never be silently unreachable per personal preference.
 */
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "task",
    label: "المهام",
    types: ["task_assigned", "task_pending_review", "task_completed", "task_rejected", "task_overdue", "task_status_changed"],
  },
  {
    key: "reminder",
    label: "تذكيرات المواعيد",
    types: ["reminder_1week", "reminder_3days", "reminder_1day", "reminder_2hours", "reminder_30min"],
  },
  {
    key: "meeting",
    label: "الاجتماعات",
    types: ["meeting_invited", "meeting_reminder_1day", "meeting_reminder_1hour"],
  },
  {
    key: "workflow",
    label: "الطلبات والموافقات",
    types: ["workflow_pending_approval", "workflow_approved", "workflow_rejected", "workflow_escalated", "user_pending_approval", "password_reset_request"],
  },
  {
    key: "knowledge",
    label: "قاعدة المعرفة",
    types: ["knowledge_published"],
  },
  {
    key: "comment",
    label: "التعليقات",
    types: ["comment_reply", "comment_mention"],
  },
  {
    key: "automation",
    label: "الأتمتة و SLA",
    types: ["automation", "sla_response_breached", "sla_resolution_breached"],
  },
  {
    key: "chat",
    label: "المحادثات",
    types: ["chat_message"],
  },
];
