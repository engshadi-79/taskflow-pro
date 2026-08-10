export type ApproverType = "department_manager" | "super_admin" | "specific_user";
export type WorkflowRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
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
  current_step_position: number;
  is_escalated: boolean;
  current_step_override_user_id: string | null;
  status: WorkflowRequestStatus;
  created_at: string;
  updated_at: string;
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

export const WORKFLOW_STATUS_LABEL: Record<WorkflowRequestStatus, string> = {
  pending: "قيد المعالجة",
  approved: "مقبول",
  rejected: "مرفوض",
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
