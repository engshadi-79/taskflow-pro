import type { Priority } from "@/lib/types/task";

export type ApproverType = "department_manager" | "super_admin" | "specific_user";
export type TaskAssigneeType = "requester" | "department_manager" | "specific_user";
export type WorkflowRequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "cancelled";
export type WorkflowActionType =
  | "submit"
  | "approve"
  | "reject"
  | "return"
  | "escalate"
  | "reassign"
  | "cancel";

export type WorkflowTemplate = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  /** Target turnaround time for a request of this type - null means no
   * SLA tracked for it. */
  sla_hours: number | null;
  /** Whether reaching final approval spawns a real task (Request ≠ Task:
   * a request can generate one or more tasks via the workflow, per the
   * architectural decision this was built for) instead of just landing
   * on "approved". */
  creates_task: boolean;
  task_assignee_type: TaskAssigneeType | null;
  task_assignee_user_id: string | null;
  created_at: string;
};

export type WorkflowStep = {
  id: string;
  template_id: string;
  position: number;
  name: string;
  approver_type: ApproverType;
  specific_user_id: string | null;
  created_at: string;
};

export type WorkflowRequest = {
  id: string;
  organization_id: string;
  template_id: string;
  requested_by: string;
  title: string;
  details: string | null;
  priority: Priority;
  current_step_position: number;
  is_escalated: boolean;
  current_step_override_user_id: string | null;
  status: WorkflowRequestStatus;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRequestAttachment = {
  id: string;
  request_id: string;
  uploaded_by: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
};

export type WorkflowAction = {
  id: string;
  request_id: string;
  step_position: number;
  actor_id: string;
  action_type: WorkflowActionType;
  note: string | null;
  created_at: string;
};

export const APPROVER_TYPE_LABEL: Record<ApproverType, string> = {
  department_manager: "مدير القسم (لمقدّم الطلب)",
  super_admin: "المدير العام",
  specific_user: "شخص محدَّد",
};

export const TASK_ASSIGNEE_TYPE_LABEL: Record<TaskAssigneeType, string> = {
  requester: "مقدّم الطلب",
  department_manager: "مدير القسم (لمقدّم الطلب)",
  specific_user: "شخص محدَّد",
};

export const WORKFLOW_STATUS_LABEL: Record<WorkflowRequestStatus, string> = {
  draft: "مسودة",
  pending: "قيد المعالجة",
  approved: "مقبول",
  rejected: "مرفوض",
  processing: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغى",
};

export const WORKFLOW_ACTION_LABEL: Record<WorkflowActionType, string> = {
  submit: "تقديم الطلب",
  approve: "قبول",
  reject: "رفض",
  return: "إعادة للخطوة السابقة",
  escalate: "تصعيد",
  reassign: "إعادة تعيين",
  cancel: "إلغاء",
};
