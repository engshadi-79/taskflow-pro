import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { WorkflowRequestActions } from "@/components/dashboard/workflow-request-actions";
import {
  WORKFLOW_ACTION_LABEL,
  WORKFLOW_STATUS_LABEL,
  type WorkflowAction,
  type WorkflowRequest,
  type WorkflowStep,
} from "@/lib/types/workflow";

export default async function WorkflowRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [{ data: request }, { data: actions }, { data: canActRows }, { data: employees }] = await Promise.all([
    supabase
      .from("workflow_requests")
      .select("*, template:workflow_templates(name), requester:users!workflow_requests_requested_by_fkey(full_name)")
      .eq("id", id)
      .single<WorkflowRequest & { template: { name: string } | null; requester: { full_name: string } | null }>(),
    supabase
      .from("workflow_actions")
      .select("*, actor:users(full_name)")
      .eq("request_id", id)
      .order("created_at", { ascending: true })
      .returns<(WorkflowAction & { actor: { full_name: string } | null })[]>(),
    supabase.rpc("can_act_on_workflow_request", { p_request_id: id }),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  if (!request) {
    notFound();
  }

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("template_id", request.template_id)
    .order("position")
    .returns<WorkflowStep[]>();

  const canAct = (canActRows as boolean | null) === true;
  const isRequester = request.requested_by === profile.id;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/workflow-requests" className="text-[12.5px] font-bold text-accent-600 hover:underline">
          ← الطلبات
        </Link>
        <h1 className="font-display text-[20px] text-foreground">{request.title}</h1>
        <p className="text-sm text-muted">
          {request.template?.name} — مقدَّم من {request.requester?.full_name}
        </p>
      </div>

      <div className="rounded-[18px] border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-extrabold text-foreground">
            الحالة: {WORKFLOW_STATUS_LABEL[request.status]}
            {request.status === "pending" && request.is_escalated && " (مصعَّد للمدير العام)"}
          </span>
          {request.status === "pending" && (
            <span className="text-[12.5px] text-muted">الخطوة {request.current_step_position}</span>
          )}
        </div>
        {request.details && <p className="text-sm text-foreground">{request.details}</p>}

        <ol className="mt-4 flex flex-wrap gap-2">
          {(steps ?? []).map((step) => (
            <li
              key={step.id}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                request.status === "pending" && step.position === request.current_step_position
                  ? "bg-accent-500 text-white"
                  : step.position < request.current_step_position || request.status === "approved"
                    ? "bg-green-50 text-green-600"
                    : "border border-border bg-background text-muted"
              }`}
            >
              {step.position}. {step.name}
            </li>
          ))}
        </ol>
      </div>

      <WorkflowRequestActions
        requestId={request.id}
        canAct={canAct && request.status === "pending"}
        isRequester={isRequester && request.status === "pending"}
        employees={employees ?? []}
      />

      <div className="rounded-[18px] border border-border bg-surface p-6">
        <h2 className="mb-3 text-sm font-extrabold text-foreground">سجل الإجراءات</h2>
        <ul className="space-y-2">
          {(actions ?? []).map((action) => (
            <li key={action.id} className="rounded-md bg-background px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {action.actor?.full_name ?? "—"} — {WORKFLOW_ACTION_LABEL[action.action_type]}
                </span>
                <span className="text-[12px] text-muted">{new Date(action.created_at).toLocaleString("ar")}</span>
              </div>
              {action.note && <p className="mt-1 text-[12.5px] text-muted">{action.note}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
