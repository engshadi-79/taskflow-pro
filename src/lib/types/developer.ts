export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type WebhookKind = "generic" | "slack" | "teams";

export const WEBHOOK_KIND_LABEL: Record<WebhookKind, string> = {
  generic: "عام (JSON + توقيع HMAC)",
  slack: "Slack",
  teams: "Microsoft Teams",
};

export type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  kind: WebhookKind;
  is_active: boolean;
  created_at: string;
};

export type WebhookDelivery = {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: "delivered" | "failed";
  response_status: number | null;
  error: string | null;
  created_at: string;
};

export const WEBHOOK_EVENTS = ["task.created", "task.status_changed", "task.completed"] as const;

export const EVENT_LABEL: Record<string, string> = {
  "task.created": "عند إنشاء مهمة",
  "task.status_changed": "عند تغيّر حالة مهمة",
  "task.completed": "عند اكتمال مهمة",
};
