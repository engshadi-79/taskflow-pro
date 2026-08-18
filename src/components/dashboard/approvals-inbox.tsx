"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actOnWorkflowRequest, bulkApproveWorkflowRequests } from "@/lib/actions/workflow";
import { GearIcon } from "@/components/shared/icons";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";

type RequestRow = {
  id: string;
  title: string;
  priority: string;
  current_step_position: number;
  is_escalated: boolean;
  sla_due_at: string | null;
  template_name: string | null;
  requester_name: string | null;
};

export function ApprovalsInbox({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === requests.length ? new Set() : new Set(requests.map((r) => r.id))));
  }

  async function handleApprove(id: string) {
    setPendingId(id);
    setError(null);
    const result = await actOnWorkflowRequest(id, "approve");
    setPendingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReject(id: string) {
    setPendingId(id);
    setError(null);
    const result = await actOnWorkflowRequest(id, "reject", reason || undefined);
    setPendingId(null);
    setRejectingId(null);
    setReason("");
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setBulkPending(true);
    setError(null);
    const result = await bulkApproveWorkflowRequests([...selected]);
    setBulkPending(false);
    setSelected(new Set());
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">طلبات بانتظار موافقتي</h2>
        {requests.length > 0 && (
          <button
            type="button"
            disabled={selected.size === 0 || bulkPending}
            onClick={handleBulkApprove}
            className="rounded-full bg-accent-500 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {bulkPending ? "جارٍ التنفيذ..." : `الموافقة على المحدَّد (${selected.size})`}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
            <GearIcon className="h-5 w-5" />
          </span>
          <p className="text-[13px] text-muted">لا توجد طلبات بانتظار موافقتك</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-faint">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" checked={selected.size === requests.length} onChange={toggleAll} />
                </th>
                <th className="px-2 py-2 text-start">العنوان</th>
                <th className="px-2 py-2 text-start">النوع</th>
                <th className="px-2 py-2 text-start">مقدّم الطلب</th>
                <th className="px-2 py-2 text-start">الأولوية</th>
                <th className="px-2 py-2 text-start">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-background">
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-2 py-2.5">
                    <Link href={`/dashboard/workflow-requests/${r.id}`} className="font-medium text-foreground hover:text-accent-600">
                      {r.title}
                    </Link>
                    {r.is_escalated && <span className="ms-1.5 text-[11px] font-bold text-red-600">(مصعَّد)</span>}
                  </td>
                  <td className="px-2 py-2.5 text-muted">{r.template_name ?? "—"}</td>
                  <td className="px-2 py-2.5 text-muted">{r.requester_name ?? "—"}</td>
                  <td className="px-2 py-2.5 text-muted">{PRIORITY_LABEL[r.priority as Priority] ?? r.priority}</td>
                  <td className="px-2 py-2.5">
                    {rejectingId === r.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="سبب الرفض (اختياري)"
                          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] outline-none focus:border-accent-500"
                        />
                        <button
                          type="button"
                          disabled={pendingId === r.id}
                          onClick={() => handleReject(r.id)}
                          className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600"
                        >
                          تأكيد
                        </button>
                        <button type="button" onClick={() => setRejectingId(null)} className="text-[11px] text-muted hover:underline">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={pendingId === r.id}
                          onClick={() => handleApprove(r.id)}
                          className="rounded-full bg-green-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-green-600 disabled:opacity-60"
                        >
                          موافقة
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === r.id}
                          onClick={() => setRejectingId(r.id)}
                          className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-60"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
