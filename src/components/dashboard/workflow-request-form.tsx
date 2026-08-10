"use client";

import { useActionState } from "react";
import { submitWorkflowRequest, type WorkflowFormState } from "@/lib/actions/workflow";
import type { WorkflowTemplate } from "@/lib/types/workflow";

const initialState: WorkflowFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function WorkflowRequestForm({ templates }: { templates: WorkflowTemplate[] }) {
  const [state, formAction, pending] = useActionState(submitWorkflowRequest, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-[18px] border border-border bg-surface p-5">
      <h2 className="text-sm font-extrabold text-foreground">طلب جديد</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">تفاصيل إضافية</span>
        <textarea name="details" rows={2} className={inputClass} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ التقديم..." : "تقديم الطلب"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
