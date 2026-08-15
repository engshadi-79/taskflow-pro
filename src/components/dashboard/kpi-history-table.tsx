import { KPI_WEIGHTS } from "@/lib/types/kpi";

type HistoryRow = {
  id: string;
  employee_name: string | null;
  period_start: string;
  period_end: string;
  completion_score: number;
  on_time_score: number;
  quality_score: number;
  manager_evaluation_score: number | null;
  total_score: number | null;
  manager_note: string | null;
};

export function KpiHistoryTable({ rows, showEmployeeColumn = true }: { rows: HistoryRow[]; showEmployeeColumn?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-muted">لا توجد تقييمات معتمَدة بعد</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-faint">
          <tr>
            {showEmployeeColumn && <th className="px-2 py-2 text-start">الموظف</th>}
            <th className="px-2 py-2 text-start">الفترة</th>
            <th className="px-2 py-2 text-start">الإنجاز ({Math.round(KPI_WEIGHTS.completion * 100)}٪)</th>
            <th className="px-2 py-2 text-start">الالتزام بالوقت ({Math.round(KPI_WEIGHTS.on_time * 100)}٪)</th>
            <th className="px-2 py-2 text-start">الجودة ({Math.round(KPI_WEIGHTS.quality * 100)}٪)</th>
            <th className="px-2 py-2 text-start">تقييم المدير ({Math.round(KPI_WEIGHTS.manager_evaluation * 100)}٪)</th>
            <th className="px-2 py-2 text-start">النتيجة الإجمالية</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              {showEmployeeColumn && <td className="px-2 py-2.5 font-medium text-foreground">{r.employee_name ?? "—"}</td>}
              <td className="px-2 py-2.5 text-muted">{r.period_start} - {r.period_end}</td>
              <td className="px-2 py-2.5 text-muted">{r.completion_score}٪</td>
              <td className="px-2 py-2.5 text-muted">{r.on_time_score}٪</td>
              <td className="px-2 py-2.5 text-muted">{r.quality_score}٪</td>
              <td className="px-2 py-2.5 text-muted">{r.manager_evaluation_score ?? "—"}٪</td>
              <td className="px-2 py-2.5 font-extrabold text-accent-600">{r.total_score ?? "—"}٪</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
