"use client";

import { useActionState } from "react";
import { submitWorkflowRequest, type WorkflowFormState } from "@/lib/actions/workflow";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";
import type { WorkflowTemplate } from "@/lib/types/workflow";

const initialState: WorkflowFormState = {};

export function MobileRequestForm({ templates }: { templates: WorkflowTemplate[] }) {
  const [state, formAction, pending] = useActionState(submitWorkflowRequest, initialState);

  return (
    <form action={formAction} className="mb-4 flex flex-col gap-2.5 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
      <div className="mb-1 text-[12.5px] font-extrabold text-foreground">تقديم طلب جديد</div>
      <select
        name="template_id"
        required
        defaultValue=""
        className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
      >
        <option value="" disabled>
          اختر نوع الطلب
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        name="title"
        required
        placeholder="عنوان الطلب"
        className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
      />
      <textarea
        name="details"
        rows={2}
        placeholder="سبب الطلب..."
        className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
      />
      <select
        name="priority"
        defaultValue="medium"
        className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
      >
        {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-[10px] bg-accent-600 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-60">
        إرسال الطلب
      </button>
      {state?.error && <p className="text-[11.5px] text-brand-red-600">{state.error}</p>}
    </form>
  );
}
