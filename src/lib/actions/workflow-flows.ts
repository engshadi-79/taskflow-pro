"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { logActivity } from "@/lib/foundation/audit";
import type { FlowNodeType } from "@/lib/types/workflow-flow";

export type FlowFormState = { error?: string };

export async function createWorkflowFlow(
  _prevState: FlowFormState,
  formData: FormData
): Promise<FlowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بإنشاء سير عمل جديد" };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!name) return { error: "اسم سير العمل مطلوب" };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("create_workflow_flow", {
    p_name: name,
    p_description: description,
  });

  if (error || !newId) return { error: error?.message || "تعذر إنشاء سير العمل" };

  revalidatePath("/dashboard/workflow-builder");
  redirect(`/dashboard/workflow-builder/${newId}`);
}

export async function createFlowVersion(flowId: string): Promise<{ error?: string; newId?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("create_flow_version", { p_flow_id: flowId });
  if (error || !newId) return { error: error?.message || "تعذر إنشاء نسخة جديدة" };

  revalidatePath("/dashboard/workflow-builder");
  return { newId };
}

export async function publishFlowVersion(flowId: string): Promise<FlowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_flow_version", { p_flow_id: flowId });
  if (error) return { error: error.message || "تعذر نشر سير العمل" };

  await logActivity(supabase, {
    organizationId: profile.organization_id,
    userId: profile.id,
    actionType: "workflow_flow_published",
    entityType: "workflow_flow",
    entityId: flowId,
  });

  revalidatePath("/dashboard/workflow-builder");
  revalidatePath(`/dashboard/workflow-builder/${flowId}`);
  return {};
}

export async function toggleFlowActive(flowId: string, isActive: boolean): Promise<FlowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workflow_flows").update({ is_active: isActive }).eq("id", flowId);

  if (error) {
    if (error.code === "23505") return { error: "توجد نسخة أخرى فعّالة لهذا السير بالفعل - عطّلها أولًا" };
    return { error: error.message || "تعذر التحديث" };
  }

  revalidatePath("/dashboard/workflow-builder");
  return {};
}

export async function deleteWorkflowFlow(flowId: string): Promise<FlowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { data: flow } = await supabase.from("workflow_flows").select("status").eq("id", flowId).single();
  if (flow?.status === "published") return { error: "لا يمكن حذف نسخة منشورة - عطّلها أو أنشئ نسخة جديدة بدلًا من ذلك" };

  const { error } = await supabase.from("workflow_flows").delete().eq("id", flowId);
  if (error) return { error: error.message || "تعذر الحذف" };

  revalidatePath("/dashboard/workflow-builder");
  return {};
}

type CanvasNode = {
  /** A real uuid generated client-side even for a brand-new node (see
   * workflow-flow-canvas.tsx) - `isNew` says whether it needs INSERT
   * (with this id supplied explicitly, overriding the column default) or
   * UPDATE. Edges reference these same ids directly either way, so no
   * id-remapping step is needed after saving. */
  id: string;
  isNew: boolean;
  node_type: FlowNodeType;
  position_x: number;
  position_y: number;
  config: Record<string, string>;
};

type CanvasEdge = {
  from_node_id: string;
  to_node_id: string;
  condition_branch: "true" | "false" | null;
};

/**
 * One "save" call reconciles the whole canvas rather than firing a
 * mutation per drag/connect: new nodes are inserted with their
 * client-generated id, existing ones updated in place, any DB node no
 * longer present is deleted (cascades to its edges), and edges are fully
 * replaced since they have no identity worth diffing beyond
 * (from, to, branch).
 */
export async function saveFlowCanvas(
  flowId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): Promise<FlowFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بتعديل سير العمل" };
  }

  const supabase = await createClient();

  const { data: flow } = await supabase.from("workflow_flows").select("status").eq("id", flowId).single();
  if (!flow) return { error: "سير العمل غير موجود" };
  if (flow.status === "published") {
    return { error: "لا يمكن تعديل نسخة منشورة - أنشئ نسخة جديدة أولًا" };
  }

  for (const n of nodes) {
    if (n.isNew) {
      const { error } = await supabase.from("workflow_flow_nodes").insert({
        id: n.id,
        flow_id: flowId,
        node_type: n.node_type,
        position_x: n.position_x,
        position_y: n.position_y,
        config: n.config,
      });
      if (error) return { error: "تعذر حفظ إحدى الخطوات" };
    } else {
      const { error } = await supabase
        .from("workflow_flow_nodes")
        .update({ position_x: n.position_x, position_y: n.position_y, config: n.config })
        .eq("id", n.id);
      if (error) return { error: "تعذر حفظ إحدى الخطوات" };
    }
  }

  const { data: existingNodes } = await supabase.from("workflow_flow_nodes").select("id").eq("flow_id", flowId);
  const keptIds = new Set(nodes.map((n) => n.id));
  const toDelete = (existingNodes ?? []).map((r) => r.id).filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from("workflow_flow_nodes").delete().in("id", toDelete);
  }

  await supabase.from("workflow_flow_edges").delete().eq("flow_id", flowId);
  if (edges.length > 0) {
    const { error } = await supabase.from("workflow_flow_edges").insert(
      edges.map((e) => ({ flow_id: flowId, ...e }))
    );
    if (error) return { error: "تعذر حفظ الروابط بين الخطوات" };
  }

  revalidatePath(`/dashboard/workflow-builder/${flowId}`);
  return {};
}

export async function runFlowTest(
  flowId: string,
  entityType: "task" | "project",
  entityId: string
): Promise<{ error?: string; executionId?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !can.manageWorkflowTemplates(profile)) {
    return { error: "غير مصرح لك بهذا الإجراء" };
  }

  const supabase = await createClient();
  const { data: executionId, error } = await supabase.rpc("run_flow_test", {
    p_flow_id: flowId,
    p_entity_type: entityType,
    p_entity_id: entityId,
  });

  if (error) return { error: error.message || "تعذر تشغيل الاختبار" };

  revalidatePath(`/dashboard/workflow-builder/${flowId}`);
  return { executionId };
}

export async function actOnFlowApproval(
  approvalId: string,
  approved: boolean,
  note?: string
): Promise<FlowFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("act_on_flow_approval", {
    p_approval_id: approvalId,
    p_approved: approved,
    p_note: note || null,
  });

  if (error) return { error: error.message || "تعذر تنفيذ الإجراء" };

  revalidatePath("/dashboard/workflow-builder");
  return {};
}
