"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import type { ApproverType, WorkflowActionType } from "@/lib/types/workflow";

export type WorkflowFormState = { error?: string };

// ============================================================
// template/step management - super_admin only, mirrors sla-policies.ts
// ============================================================
export async function createWorkflowTemplate(
  _prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بإدارة أنواع الطلبات" };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!name) return { error: "اسم نوع الطلب مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase.from("workflow_templates").insert({
    organization_id: profile.organization_id,
    name,
    description,
  });

  if (error) return { error: "تعذر إنشاء نوع الطلب" };

  revalidatePath("/dashboard/workflow-templates");
  return {};
}

export async function toggleWorkflowTemplateActive(id: string, isActive: boolean): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بإدارة أنواع الطلبات" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workflow_templates").update({ is_active: isActive }).eq("id", id);

  revalidatePath("/dashboard/workflow-templates");
  return error ? { error: "تعذر التحديث" } : {};
}

export async function addWorkflowStep(
  _prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بإدارة أنواع الطلبات" };
  }

  const templateId = formData.get("template_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const position = Number(formData.get("position"));
  const approverType = formData.get("approver_type") as ApproverType;
  const specificUserId = (formData.get("specific_user_id") as string) || null;

  if (!name) return { error: "اسم الخطوة مطلوب" };
  if (!position || position < 1) return { error: "ترتيب الخطوة يجب أن يكون رقمًا موجبًا" };
  if (approverType === "specific_user" && !specificUserId) {
    return { error: "اختر الشخص المسؤول عن هذه الخطوة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workflow_steps").insert({
    template_id: templateId,
    name,
    position,
    approver_type: approverType,
    specific_user_id: approverType === "specific_user" ? specificUserId : null,
  });

  if (error) return { error: error.message || "تعذر إضافة الخطوة" };

  revalidatePath("/dashboard/workflow-templates");
  return {};
}

export async function deleteWorkflowStep(id: string): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بإدارة أنواع الطلبات" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workflow_steps").delete().eq("id", id);

  revalidatePath("/dashboard/workflow-templates");
  return error ? { error: "تعذر حذف الخطوة" } : {};
}

// ============================================================
// requests - every mutation goes through the two SECURITY DEFINER
// functions in workflow_engine.sql, which do their own authorization
// check; these wrappers just surface a readable error message.
// ============================================================
export async function submitWorkflowRequest(
  _prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const templateId = formData.get("template_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const details = (formData.get("details") as string)?.trim() || null;
  const priority = (formData.get("priority") as string) || "medium";
  const saveAsDraft = formData.get("save_as_draft") === "true";

  if (!templateId) return { error: "اختر نوع الطلب" };
  if (!title) return { error: "عنوان الطلب مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_workflow_request", {
    p_template_id: templateId,
    p_title: title,
    p_details: details,
    p_priority: priority,
    p_save_as_draft: saveAsDraft,
  });

  if (error) return { error: error.message || "تعذر تقديم الطلب" };

  revalidatePath("/dashboard/workflow-requests");
  return {};
}

export async function updateWorkflowRequestDraft(
  requestId: string,
  _prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  const title = (formData.get("title") as string)?.trim();
  const details = (formData.get("details") as string)?.trim() || null;
  const priority = (formData.get("priority") as string) || "medium";

  if (!title) return { error: "عنوان الطلب مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_workflow_request_draft", {
    p_request_id: requestId,
    p_title: title,
    p_details: details,
    p_priority: priority,
  });

  if (error) return { error: error.message || "تعذر تعديل المسودة" };

  revalidatePath("/dashboard/workflow-requests");
  revalidatePath(`/dashboard/workflow-requests/${requestId}`);
  return {};
}

export async function submitWorkflowRequestDraft(requestId: string): Promise<WorkflowFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_workflow_request_draft", { p_request_id: requestId });

  revalidatePath("/dashboard/workflow-requests");
  revalidatePath(`/dashboard/workflow-requests/${requestId}`);
  return error ? { error: error.message || "تعذر إرسال المسودة" } : {};
}

const MAX_REQUEST_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_REQUEST_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export async function uploadWorkflowRequestAttachment(
  _prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const requestId = formData.get("request_id") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { error: "اختر ملفًا للرفع" };
  if (file.size > MAX_REQUEST_ATTACHMENT_BYTES) return { error: "حجم الملف يجب ألا يتجاوز 20 ميجابايت" };
  if (file.type && !ALLOWED_REQUEST_ATTACHMENT_TYPES.includes(file.type)) {
    return { error: "نوع الملف غير مدعوم" };
  }

  const supabase = await createClient();
  const path = `${requestId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("workflow-request-attachments").upload(path, file);
  if (uploadError) return { error: "تعذر رفع الملف" };

  const { error: insertError } = await supabase.from("workflow_request_attachments").insert({
    request_id: requestId,
    uploaded_by: profile.id,
    file_url: path,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
  });

  if (insertError) {
    await supabase.storage.from("workflow-request-attachments").remove([path]);
    return { error: "تعذر حفظ بيانات المرفق" };
  }

  revalidatePath(`/dashboard/workflow-requests/${requestId}`);
  return {};
}

export async function deleteWorkflowRequestAttachment(id: string, requestId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("workflow-request-attachments").remove([filePath]);
  await supabase.from("workflow_request_attachments").delete().eq("id", id);
  revalidatePath(`/dashboard/workflow-requests/${requestId}`);
}

export async function actOnWorkflowRequest(
  requestId: string,
  action: WorkflowActionType,
  note?: string,
  targetUserId?: string
): Promise<WorkflowFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("act_on_workflow_request", {
    p_request_id: requestId,
    p_action: action,
    p_note: note || null,
    p_target_user_id: targetUserId || null,
  });

  revalidatePath("/dashboard/workflow-requests");
  revalidatePath(`/dashboard/workflow-requests/${requestId}`);
  return error ? { error: error.message || "تعذر تنفيذ الإجراء" } : {};
}

export async function bulkApproveWorkflowRequests(requestIds: string[]): Promise<WorkflowFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("bulk_approve_workflow_requests", { p_request_ids: requestIds });

  revalidatePath("/dashboard/workflow-requests");
  revalidatePath("/dashboard/approvals");
  return error ? { error: error.message || "تعذر تنفيذ الموافقة الجماعية" } : {};
}
