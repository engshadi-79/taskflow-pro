export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  meeting_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};
