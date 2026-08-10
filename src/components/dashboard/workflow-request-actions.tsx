"use client";

import { useState } from "react";
import { actOnWorkflowRequest } from "@/lib/actions/workflow";
import type { WorkflowActionType } from "@/lib/types/workflow";

type EmployeeOption = { id: string; full_name: string };

export function WorkflowRequestActions({
  requestId,
  canAct,
  isRequester,
  employees,
}: {
  requestId: string;
  canAct: boolean;
  isRequester: boolean;
  employees: EmployeeOption[];
}) {
  const [note, setNote] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [pending, setPending] = useState<WorkflowActionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: WorkflowActionType, targetUserId?: string) {
    setPending(action);
    setError(null);
    const result = await actOnWorkflowRequest(requestId, action, note, targetUserId);
    setPending(null);
    if (result?.error) setError(result.error);
    else setNote("");
  }

  if (!canAct && !isRequester) return null;

  return (
    <div className="space-y-3 rounded-[18px] border border-border bg-surface p-5">
      <h2 className="text-sm font-extrabold text-foreground">إجراء</h2>

      {canAct && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">ملاحظة (اختياري)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run("approve")}
              className="rounded-[10px] bg-green-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-green-600 disabled:opacity-60"
            >
              قبول
            </button>
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run("reject")}
              className="rounded-[10px] bg-brand-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-red-600 disabled:opacity-60"
            >
              رفض
            </button>
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run("return")}
              className="rounded-[10px] border border-border px-4 py-2 text-sm font-extrabold text-foreground hover:bg-background disabled:opacity-60"
            >
              إعادة للخطوة السابقة
            </button>
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run("escalate")}
              className="rounded-[10px] border border-border px-4 py-2 text-sm font-extrabold text-foreground hover:bg-background disabled:opacity-60"
            >
              تصعيد للمدير العام
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
            >
              <option value="">إعادة تعيين إلى...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!!pending || !reassignTo}
              onClick={() => run("reassign", reassignTo)}
              className="rounded-[10px] border border-border px-4 py-2 text-sm font-extrabold text-foreground hover:bg-background disabled:opacity-60"
            >
              إعادة تعيين
            </button>
          </div>
        </>
      )}

      {isRequester && (
        <button
          type="button"
          disabled={!!pending}
          onClick={() => {
            if (!confirm("إلغاء هذا الطلب؟")) return;
            run("cancel");
          }}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          إلغاء الطلب
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
