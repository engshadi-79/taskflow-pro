"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateWorkflowRequestDraft,
  submitWorkflowRequestDraft,
  actOnWorkflowRequest,
  type WorkflowFormState,
} from "@/lib/actions/workflow";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";
import type { WorkflowRequest } from "@/lib/types/workflow";

const initialState: WorkflowFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function WorkflowRequestDraftEditor({ request }: { request: WorkflowRequest }) {
  const router = useRouter();
  const updateWithId = (prevState: WorkflowFormState, formData: FormData) =>
    updateWorkflowRequestDraft(request.id, prevState, formData);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSubmitRequest() {
    setSubmitting(true);
    setActionError(null);
    const result = await submitWorkflowRequestDraft(request.id);
    setSubmitting(false);
    if (result?.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleCancel() {
    setCancelling(true);
    setActionError(null);
    const result = await actOnWorkflowRequest(request.id, "cancel");
    setCancelling(false);
    if (result?.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={formAction} className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">مسودة — لم تُرسل بعد</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الطلب</span>
          <input name="title" defaultValue={request.title} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" defaultValue={request.priority} className={inputClass}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">تفاصيل إضافية</span>
        <textarea name="details" defaultValue={request.details ?? ""} rows={2} className={inputClass} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-background disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmitRequest}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {submitting ? "جارٍ الإرسال..." : "إرسال الطلب"}
        </button>
        <button
          type="button"
          disabled={cancelling}
          onClick={handleCancel}
          className="rounded-[10px] border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {cancelling ? "جارٍ الحذف..." : "حذف المسودة"}
        </button>
        {(state?.error || actionError) && <p className="text-sm text-red-600">{state?.error ?? actionError}</p>}
      </div>
    </form>
  );
}
