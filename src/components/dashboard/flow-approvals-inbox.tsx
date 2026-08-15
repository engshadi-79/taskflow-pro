"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actOnFlowApproval } from "@/lib/actions/workflow-flows";
import { timeAgo } from "@/lib/format-time-ago";

type FlowApprovalRow = {
  id: string;
  flow_id: string;
  flow_name: string | null;
  created_at: string;
};

export function FlowApprovalsInbox({ approvals }: { approvals: FlowApprovalRow[] }) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAct(id: string, approved: boolean) {
    setActingId(id);
    setError(null);
    const result = await actOnFlowApproval(id, approved);
    setActingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (approvals.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-extrabold text-foreground">موافقات سلاسل العمل التلقائية</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {approvals.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
            <Link href={`/dashboard/workflow-builder/${a.flow_id}`} className="text-[13px] font-bold text-accent-600 hover:underline">
              {a.flow_name ?? "سير عمل"} — منذ {timeAgo(a.created_at)}
            </Link>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
