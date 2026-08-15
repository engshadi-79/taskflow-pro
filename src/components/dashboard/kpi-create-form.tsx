"use client";

import { useActionState } from "react";
import { createEmployeeKpiEvaluation, type KpiFormState } from "@/lib/actions/kpi";

const initialState: KpiFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500";

export function KpiCreateForm({ employees }: { employees: { id: string; full_name: string }[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeKpiEvaluation, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2.5 rounded-[14px] border border-border bg-background p-3">
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">الموظف</span>
        <select name="user_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>اختر موظفًا</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">من</span>
        <input type="date" name="period_start" required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">إلى</span>
        <input type="date" name="period_end" required className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "جارٍ الحساب..." : "بدء تقييم جديد"}
      </button>
      {state?.error && <p className="w-full text-[12px] text-red-600">{state.error}</p>}
    </form>
  );
}
