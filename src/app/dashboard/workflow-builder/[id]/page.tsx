import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/foundation/permissions";
import { WorkflowFlowCanvas } from "@/components/dashboard/workflow-flow-canvas";
import { WorkflowFlowExecutionsPanel } from "@/components/dashboard/workflow-flow-executions-panel";
import type { WorkflowFlow, WorkflowFlowNode, WorkflowFlowEdge } from "@/lib/types/workflow-flow";

export default async function WorkflowFlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can.manageWorkflowTemplates(profile)) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: flow }, { data: nodes }, { data: edges }, { data: employees }, { data: executions }] = await Promise.all([
    supabase.from("workflow_flows").select("*").eq("id", id).single<WorkflowFlow>(),
    supabase.from("workflow_flow_nodes").select("*").eq("flow_id", id).returns<WorkflowFlowNode[]>(),
    supabase.from("workflow_flow_edges").select("*").eq("flow_id", id).returns<WorkflowFlowEdge[]>(),
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase
      .from("workflow_flow_executions")
      .select("*")
      .eq("flow_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  if (!flow) notFound();

  const executionIds = (executions ?? []).map((e) => e.id);

  const [{ data: logs }, { data: approvalsRaw }] = await Promise.all([
    executionIds.length > 0
      ? supabase.from("workflow_flow_execution_logs").select("*").in("execution_id", executionIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("workflow_flow_approvals")
      .select("*, execution:workflow_flow_executions!inner(flow_id), approver:users(full_name)")
      .eq("execution.flow_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const approvals = (approvalsRaw ?? []).map((a) => ({
    id: a.id as string,
    execution_id: a.execution_id as string,
    status: a.status as string,
    approver_user_id: a.approver_user_id as string | null,
    approver_name: (a.approver as { full_name: string } | null)?.full_name ?? null,
    timeout_at: a.timeout_at as string | null,
    created_at: a.created_at as string,
  }));

  return (
    <div className="space-y-4.5">
      <Link href="/dashboard/workflow-builder" className="text-[12.5px] font-bold text-accent-600 hover:underline">
        ← باني سير العمل
      </Link>

      <WorkflowFlowCanvas
        flow={flow}
        initialNodes={nodes ?? []}
        initialEdges={edges ?? []}
        employees={(employees ?? []).filter((e) => e.id !== profile.id)}
      />

      <WorkflowFlowExecutionsPanel
        executions={executions ?? []}
        logs={logs ?? []}
        approvals={approvals}
        currentUserId={profile.id}
        canActOnAnyApproval={profile.role === "super_admin"}
      />
    </div>
  );
}
