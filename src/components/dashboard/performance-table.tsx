export type PerformanceRow = {
  key: string;
  name: string;
  total: number;
  completed: number;
  overdue?: number;
  completionRate: number;
  avgHours?: number | null;
};

/**
 * Shared table for Department/Employee/Project performance - a completion
 * rate bar plus the underlying counts. One shape, three report types, per
 * "طوّر النظام الحالي بدل استبداله": this is new, but it's one component
 * doing three jobs instead of three near-duplicate ones.
 */
export function PerformanceTable({ rows, nameHeader }: { rows: PerformanceRow[]; nameHeader: string }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
      <table className="w-full text-sm">
        <thead className="text-xs text-faint">
          <tr>
            <th className="px-1.5 py-4 text-start">{nameHeader}</th>
            <th className="px-1.5 py-4 text-start">الإجمالي</th>
            <th className="px-1.5 py-4 text-start">المكتملة</th>
            {rows.some((r) => r.overdue !== undefined) && (
              <th className="px-1.5 py-4 text-start">المتأخرة</th>
            )}
            <th className="px-1.5 py-4 text-start">نسبة الإنجاز</th>
            <th className="px-1.5 py-4 text-start">متوسط الساعات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-1.5 py-3 font-medium text-foreground">{row.name}</td>
              <td className="px-1.5 py-3 text-muted">{row.total}</td>
              <td className="px-1.5 py-3 text-muted">{row.completed}</td>
              {rows.some((r) => r.overdue !== undefined) && (
                <td
                  className={`px-1.5 py-3 ${
                    (row.overdue ?? 0) > 0 ? "font-semibold text-brand-red-500" : "text-muted"
                  }`}
                >
                  {row.overdue ?? 0}
                </td>
              )}
              <td className="px-1.5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-accent-500"
                      style={{ width: `${Math.min(row.completionRate, 100)}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-muted">{row.completionRate}٪</span>
                </div>
              </td>
              <td className="px-1.5 py-3 text-muted">{row.avgHours ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted">
                لا توجد بيانات كافية بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
