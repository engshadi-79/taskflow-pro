export type ConversationType = "direct" | "group";

export type ConversationSummary = {
  conversation_id: string;
  type: ConversationType;
  name: string | null;
  other_user_id: string | null;
  other_user_name: string | null;
  other_user_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ConversationParticipant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

export type ChatMessageAttachment = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  attachments: ChatMessageAttachment[];
};

export type OrgMemberDirectoryEntry = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  department_name: string | null;
};
