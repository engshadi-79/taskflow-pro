export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  meeting_id: string | null;
  article_id: string | null;
  comment_id: string | null;
  admin_notification_id: string | null;
  type: string;
  title: string | null;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};
