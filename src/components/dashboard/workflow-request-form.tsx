"use client";

import { useActionState, useRef, useState } from "react";
import { submitWorkflowRequest, type WorkflowFormState } from "@/lib/actions/workflow";
import type { WorkflowTemplate } from "@/lib/types/workflow";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";

const initialState: WorkflowFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function WorkflowRequestForm({ templates }: { templates: WorkflowTemplate[] }) {
  const [state, formAction, pending] = useActionState(submitWorkflowRequest, initialState);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function submitAs(draft: boolean) {
    setSaveAsDraft(draft);
    // state update is async - the hidden input reflects it on the next
    // render, so defer the actual submit one tick to avoid sending the
    // previous value
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-[18px] border border-border bg-surface p-5">
      <input type="hidden" name="save_as_draft" value={saveAsDraft ? "true" : "false"} />
      <h2 className="text-sm font-extrabold text-foreground">طلب جديد</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">نوع الطلب</span>
          <select name="template_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              اختر نوعًا
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الطلب</span>
          <input name="title" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" defaultValue="medium" className={inputClass}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">تفاصيل إضافية</span>
        <textarea name="details" rows={2} className={inputClass} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => submitAs(false)}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ التقديم..." : "تقديم الطلب"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submitAs(true)}
          className="rounded-[10px] border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-background disabled:opacity-60"
        >
          حفظ كمسودة
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
