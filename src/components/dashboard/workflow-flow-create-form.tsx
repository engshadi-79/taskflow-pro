"use client";

import { useActionState } from "react";
import { createWorkflowFlow, type FlowFormState } from "@/lib/actions/workflow-flows";

const initialState: FlowFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function WorkflowFlowCreateForm() {
  const [state, formAction, pending] = useActionState(createWorkflowFlow, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-[18px] border border-border bg-surface p-4 sm:flex sm:flex-wrap sm:items-end"
    >
      <label className="block w-full sm:flex-1">
        <span className="mb-1.5 block text-sm font-medium text-foreground">اسم سير العمل</span>
        <input name="name" required className={inputClass} placeholder="مثال: متابعة طلب إجازة" />
      </label>
      <label className="block w-full sm:flex-1">
        <span className="mb-1.5 block text-sm font-medium text-foreground">وصف مختصر (اختياري)</span>
        <input name="description" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "جارٍ الإنشاء..." : "سير عمل جديد"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
