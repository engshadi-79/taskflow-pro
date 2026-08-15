export type AutomationTrigger =
  | "task_created"
  | "task_status_changed"
  | "task_overdue"
  | "sla_near_breach"
  | "project_completed";

export type AutomationAction =
  | "notify_assignee"
  | "notify_creator"
  | "notify_department_manager"
  | "notify_project_manager"
  | "notify_specific_user"
  | "change_status"
  | "change_priority"
  | "create_followup_task"
  | "reassign";

export type AutomationRule = {
  id: string;
  organization_id: string;
  name: string;
  trigger_event: AutomationTrigger;
  conditions: Record<string, string> | null;
  action_type: AutomationAction;
  action_params: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
};

export type AutomationExecution = {
  id: string;
  rule_id: string;
  entity_type: "task" | "project";
  entity_id: string;
  result: "success" | "error" | "retry_pending" | "failed";
  detail: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  executed_at: string;
};

export type AutomationRuleTemplate = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_event: AutomationTrigger;
  conditions: Record<string, string> | null;
  action_type: AutomationAction;
  action_params: Record<string, string> | null;
  created_at: string;
};

export const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  task_created: "عند إنشاء مهمة",
  task_status_changed: "عند تغيّر حالة مهمة",
  task_overdue: "عند تأخّر مهمة",
  sla_near_breach: "عند اقتراب مهمة من تجاوز SLA",
  project_completed: "عند اكتمال مشروع",
};

export const ACTION_LABEL: Record<AutomationAction, string> = {
  notify_assignee: "إشعار المسؤول عن المهمة",
  notify_creator: "إشعار منشئ المهمة",
  notify_department_manager: "إشعار مدير القسم",
  notify_project_manager: "إشعار مدير المشروع",
  notify_specific_user: "إشعار شخص محدَّد",
  change_status: "تغيير الحالة",
  change_priority: "تغيير الأولوية",
  create_followup_task: "إنشاء مهمة متابعة",
  reassign: "إعادة الإسناد",
};
