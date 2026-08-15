"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actOnFlowApproval } from "@/lib/actions/workflow-flows";
import { NODE_TYPE_LABEL, FLOW_EXECUTION_STATUS_LABEL, type FlowNodeType } from "@/lib/types/workflow-flow";
import { timeAgo } from "@/lib/format-time-ago";

type ExecutionRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  retry_count: number;
  started_at: string;
  completed_at: string | null;
};

type LogRow = {
  id: string;
  execution_id: string;
  node_type: string | null;
  result: string;
  detail: string | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  execution_id: string;
  status: string;
  approver_user_id: string | null;
  approver_name: string | null;
  timeout_at: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  running: "bg-accent-50 text-accent-700",
  waiting_delay: "bg-purple-50 text-purple-600",
  waiting_approval: "bg-orange-50 text-orange-600",
  retry_pending: "bg-orange-50 text-orange-600",
  completed: "bg-green-50 text-green-600",
  failed: "bg-red-50 text-red-600",
  rejected: "bg-red-50 text-red-600",
};

export function WorkflowFlowExecutionsPanel({
  executions,
  logs,
  approvals,
  currentUserId,
  canActOnAnyApproval,
}: {
  executions: ExecutionRow[];
  logs: LogRow[];
  approvals: ApprovalRow[];
  currentUserId: string;
  canActOnAnyApproval: boolean;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  async function handleAct(approvalId: string, approved: boolean) {
    setActingId(approvalId);
    setError(null);
    const result = await actOnFlowApproval(approvalId, approved);
    setActingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {pendingApprovals.length > 0 && (
        <div className="rounded-[14px] border border-orange-200 bg-orange-50 p-4">
          <h3 className="mb-2 text-[12.5px] font-extrabold text-orange-800">موافقات بانتظار البت</h3>
          {error && <p className="mb-2 text-[12px] text-red-600">{error}</p>}
          <ul className="space-y-2">
            {pendingApprovals.map((a) => {
              const canAct = canActOnAnyApproval || a.approver_user_id === currentUserId;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-orange-200 bg-surface p-2.5">
                  <span className="text-[12.5px] text-foreground">
                    {a.approver_name ?? "—"} — منذ {timeAgo(a.created_at)}
                  </span>
                  {canAct && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => handleAct(a.id, true)}
                        className="rounded-full bg-green-500 px-3 py-1 text-[11.5px] font-bold text-white hover:bg-green-600 disabled:opacity-60"
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => handleAct(a.id, false)}
                        className="rounded-full bg-red-500 px-3 py-1 text-[11.5px] font-bold text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        رفض
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-[14px] border border-border bg-surface p-4">
        <h3 className="mb-3 text-[12.5px] font-extrabold text-foreground">سجل التنفيذ</h3>
        <div className="space-y-2">
          {executions.map((ex) => (
            <div key={ex.id} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === ex.id ? null : ex.id))}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start"
              >
                <span className="text-[12.5px] text-foreground">
                  {ex.entity_type === "task" ? "مهمة" : "مشروع"} — منذ {timeAgo(ex.started_at)}
                  {ex.retry_count > 0 && ` (محاولة ${ex.retry_count + 1})`}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_BADGE[ex.status] ?? "bg-border text-muted"}`}>
                  {FLOW_EXECUTION_STATUS_LABEL[ex.status as keyof typeof FLOW_EXECUTION_STATUS_LABEL] ?? ex.status}
                </span>
              </button>
              {expandedId === ex.id && (
                <ul className="space-y-1 border-t border-border bg-background p-2.5">
                  {logs
                    .filter((l) => l.execution_id === ex.id)
                    .map((l) => (
                      <li key={l.id} className="flex items-center justify-between text-[11.5px]">
                        <span className={l.result === "failed" ? "text-red-600" : "text-muted"}>
                          {l.node_type ? NODE_TYPE_LABEL[l.node_type as FlowNodeType] ?? l.node_type : "—"}
                          {l.detail ? `: ${l.detail}` : ""}
                        </span>
                        <span className="text-faint">{timeAgo(l.created_at)}</span>
                      </li>
                    ))}
                  {logs.filter((l) => l.execution_id === ex.id).length === 0 && (
                    <li className="text-[11.5px] text-muted">لا توجد تفاصيل</li>
                  )}
                </ul>
              )}
            </div>
          ))}
          {executions.length === 0 && <p className="text-[12.5px] text-muted">لم يُنفَّذ هذا السير بعد</p>}
        </div>
      </div>
    </div>
  );
}
