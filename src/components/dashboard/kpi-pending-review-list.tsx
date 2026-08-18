"use client";

import { useActionState } from "react";
import { finalizeEmployeeKpiEvaluation, type KpiFormState } from "@/lib/actions/kpi";
import { TrophyIcon } from "@/components/shared/icons";
import { KPI_WEIGHTS } from "@/lib/types/kpi";

const initialState: KpiFormState = {};
const inputClass =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500";

type PendingRow = {
  id: string;
  employee_name: string | null;
  period_start: string;
  period_end: string;
  completion_score: number;
  on_time_score: number;
  quality_score: number;
};

function FinalizeRow({ row }: { row: PendingRow }) {
  const action = (prevState: KpiFormState, formData: FormData) => finalizeEmployeeKpiEvaluation(row.id, prevState, formData);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="rounded-[14px] border border-orange-200 bg-orange-50 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold text-orange-800">
          {row.employee_name ?? "—"} — {row.period_start} إلى {row.period_end}
        </span>
        <span className="text-[11.5px] text-orange-700">
          الإنجاز {row.completion_score}٪ ({Math.round(KPI_WEIGHTS.completion * 100)}٪) · الالتزام بالوقت {row.on_time_score}٪ ({Math.round(KPI_WEIGHTS.on_time * 100)}٪) · الجودة {row.quality_score}٪ ({Math.round(KPI_WEIGHTS.quality * 100)}٪)
        </span>
      </div>
      <form action={formAction} className="flex flex-wrap items-end gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">تقييم المدير (0-100، وزنه {Math.round(KPI_WEIGHTS.manager_evaluation * 100)}٪)</span>
          <input type="number" name="manager_evaluation_score" min={0} max={100} required className={inputClass} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-[11.5px] text-muted">ملاحظة (اختياري)</span>
          <input name="manager_note" className={`${inputClass} w-full`} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الاعتماد..." : "اعتماد"}
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-[12px] text-red-600">{state.error}</p>}
    </div>
  );
}

export function KpiPendingReviewList({ rows }: { rows: PendingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
          <TrophyIcon className="h-5 w-5" />
        </span>
        <p className="text-[13px] text-muted">لا توجد تقييمات بانتظار مراجعتك</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <FinalizeRow key={row.id} row={row} />
      ))}
    </div>
  );
}
