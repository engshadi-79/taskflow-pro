import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { CheckCircleIcon } from "@/components/shared/icons";
import { ApprovalsInbox } from "@/components/dashboard/approvals-inbox";
import { FlowApprovalsInbox } from "@/components/dashboard/flow-approvals-inbox";
import { ApprovalDelegationManager } from "@/components/dashboard/approval-delegation-manager";

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "employee") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: requestsRaw }, { data: flowApprovalsRaw }, { data: delegationsRaw }, { data: employees }] =
    await Promise.all([
      supabase
        .from("workflow_requests")
        .select(
          "id, title, priority, current_step_position, is_escalated, sla_due_at, template:workflow_templates(name), requester:users!workflow_requests_requested_by_fkey(full_name)"
        )
        .eq("status", "pending")
        .order("sla_due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("workflow_flow_approvals")
        .select("id, created_at, execution:workflow_flow_executions(flow_id, flow:workflow_flows(name))")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("approval_delegations")
        .select(
          "id, delegator_id, delegate_id, starts_at, ends_at, delegator:users!approval_delegations_delegator_id_fkey(full_name), delegate:users!approval_delegations_delegate_id_fkey(full_name)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, full_name").order("full_name"),
    ]);

  const requests = (requestsRaw ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    priority: r.priority as string,
    current_step_position: r.current_step_position as number,
    is_escalated: r.is_escalated as boolean,
    sla_due_at: r.sla_due_at as string | null,
    template_name: (r.template as unknown as { name: string } | null)?.name ?? null,
    requester_name: (r.requester as unknown as { full_name: string } | null)?.full_name ?? null,
  }));

  const flowApprovals = (flowApprovalsRaw ?? []).map((a) => {
    const execution = a.execution as unknown as { flow_id: string; flow: { name: string } | null } | null;
    return {
      id: a.id as string,
      flow_id: execution?.flow_id ?? "",
      flow_name: execution?.flow?.name ?? null,
      created_at: a.created_at as string,
    };
  });

  const delegations = (delegationsRaw ?? []).map((d) => ({
    id: d.id as string,
    delegator_id: d.delegator_id as string,
    delegate_id: d.delegate_id as string,
    delegator_name: (d.delegator as unknown as { full_name: string } | null)?.full_name ?? null,
    delegate_name: (d.delegate as unknown as { full_name: string } | null)?.full_name ?? null,
    starts_at: d.starts_at as string,
    ends_at: d.ends_at as string,
  }));

  return (
    <div className="max-w-4xl space-y-4.5">
      <PageHeader
        title="مركز الموافقات"
        subtitle="كل ما ينتظر بتّك في مكان واحد - طلبات وسلاسل عمل تلقائية"
        variant="teal"
        icon={<CheckCircleIcon className="h-6 w-6" />}
      />

      <ApprovalsInbox requests={requests} />
      <FlowApprovalsInbox approvals={flowApprovals} />
      <ApprovalDelegationManager
        delegations={delegations}
        currentUserId={profile.id}
        employees={(employees ?? []).filter((e) => e.id !== profile.id)}
      />
    </div>
  );
}
