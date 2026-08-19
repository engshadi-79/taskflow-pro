"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actOnWorkflowRequest, bulkApproveWorkflowRequests } from "@/lib/actions/workflow";

type ApprovalRow = { id: string; title: string; requester_name: string | null; template_name: string | null; created_at: string };

export function MobileApprovalsList({ requests }: { requests: ApprovalRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  async function decide(id: string, action: "approve" | "reject") {
    setPending(true);
    await actOnWorkflowRequest(id, action);
    setPending(false);
    router.refresh();
  }

  async function bulkApprove() {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;
    setPending(true);
    await bulkApproveWorkflowRequests(ids);
    setSelected({});
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      {requests.map((r) => (
        <div key={r.id} className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
          <button
            type="button"
            onClick={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))}
            className="flex w-full items-center gap-2.5 text-start"
          >
            <span className={`h-[18px] w-[18px] shrink-0 rounded-[5px] border-2 ${selected[r.id] ? "border-accent-600 bg-accent-600" : "border-border"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground">{r.template_name ? `${r.title} (${r.template_name})` : r.title}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-muted">{r.requester_name ?? "—"}</div>
            </div>
          </button>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(r.id, "approve")}
              className="flex-1 rounded-[9px] bg-green-50 py-2 text-[11.5px] font-extrabold text-green-600 disabled:opacity-60"
            >
              موافقة
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(r.id, "reject")}
              className="flex-1 rounded-[9px] bg-brand-red-50 py-2 text-[11.5px] font-extrabold text-brand-red-600 disabled:opacity-60"
            >
              رفض
            </button>
          </div>
        </div>
      ))}
      {requests.length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد طلبات بانتظار موافقتك</p>}
      {selectedCount > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={bulkApprove}
          className="rounded-[10px] bg-accent-600 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-60"
        >
          موافقة جماعية ({selectedCount})
        </button>
      )}
    </div>
  );
}
