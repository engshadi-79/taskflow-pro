export type FlowNodeType =
  | "trigger"
  | "condition"
  | "create_task"
  | "assign"
  | "notification"
  | "delay"
  | "approval";

export type FlowTriggerEvent =
  | "task_created"
  | "task_status_changed"
  | "task_overdue"
  | "sla_near_breach"
  | "project_completed";

export type FlowStatus = "draft" | "published";

export type FlowExecutionStatus =
  | "running"
  | "waiting_delay"
  | "waiting_approval"
  | "retry_pending"
  | "completed"
  | "failed"
  | "rejected";

export type WorkflowFlow = {
  id: string;
  organization_id: string;
  flow_group_id: string;
  name: string;
  description: string | null;
  version: number;
  status: FlowStatus;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowFlowNode = {
  id: string;
  flow_id: string;
  node_type: FlowNodeType;
  position_x: number;
  position_y: number;
  config: Record<string, string>;
  created_at: string;
};

export type WorkflowFlowEdge = {
  id: string;
  flow_id: string;
  from_node_id: string;
  to_node_id: string;
  condition_branch: "true" | "false" | null;
};

export type WorkflowFlowExecution = {
  id: string;
  flow_id: string;
  organization_id: string;
  entity_type: "task" | "project";
  entity_id: string;
  status: FlowExecutionStatus;
  current_node_id: string | null;
  resume_at: string | null;
  retry_count: number;
  started_at: string;
  completed_at: string | null;
};

export type WorkflowFlowExecutionLog = {
  id: string;
  execution_id: string;
  node_id: string | null;
  node_type: string | null;
  result: "success" | "failed" | "waiting";
  detail: string | null;
  created_at: string;
};

export type WorkflowFlowApproval = {
  id: string;
  execution_id: string;
  node_id: string;
  approver_type: "department_manager" | "specific_user";
  approver_user_id: string | null;
  status: "pending" | "approved" | "rejected";
  acted_by: string | null;
  acted_at: string | null;
  timeout_at: string | null;
  created_at: string;
};

export const NODE_TYPE_LABEL: Record<FlowNodeType, string> = {
  trigger: "بداية (حدث)",
  condition: "شرط",
  create_task: "إنشاء مهمة",
  assign: "تعيين",
  notification: "إشعار",
  delay: "تأخير",
  approval: "موافقة",
};

export const TRIGGER_EVENT_LABEL: Record<FlowTriggerEvent, string> = {
  task_created: "عند إنشاء مهمة",
  task_status_changed: "عند تغيّر حالة مهمة",
  task_overdue: "عند تأخّر مهمة",
  sla_near_breach: "عند اقتراب خرق SLA",
  project_completed: "عند اكتمال مشروع",
};

export const FLOW_EXECUTION_STATUS_LABEL: Record<FlowExecutionStatus, string> = {
  running: "قيد التنفيذ",
  waiting_delay: "بانتظار التأخير",
  waiting_approval: "بانتظار الموافقة",
  retry_pending: "بانتظار إعادة المحاولة",
  completed: "مكتمل",
  failed: "فشل",
  rejected: "مرفوض",
};
