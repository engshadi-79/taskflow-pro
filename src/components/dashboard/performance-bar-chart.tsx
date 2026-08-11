import type { PerformanceRow } from "@/components/dashboard/performance-table";

/**
 * Horizontal bar chart of completionRate per row - one shared component for
 * the Department/Employee/Project/Priority performance sections, same
 * reasoning as PerformanceTable: one shape, several report types. Custom
 * divs/SVG, no charting library, matching DepartmentHoursChart/
 * StatusDonutChart already on this page.
 */
export function PerformanceBarChart({
  title,
  subtitle,
  rows,
  colorFor,
}: {
  title: string;
  subtitle: string;
  rows: PerformanceRow[];
  /** Optional per-row Tailwind bg-* class (e.g. priority-coded); defaults to the accent gradient. */
  colorFor?: (row: PerformanceRow) => string | undefined;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4">
        <h4 className="text-[14.5px] font-extrabold text-foreground">{title}</h4>
        <small className="mt-0.5 block text-[11.5px] font-medium text-faint">{subtitle}</small>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
      ) : (
        <div className="max-h-[320px] space-y-3 overflow-y-auto pe-1">
          {rows.map((row) => {
            const color = colorFor?.(row);
            return (
              <div key={row.key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12px] font-bold text-muted" title={row.name}>
                  {row.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${color ?? "bg-gradient-to-l from-accent-600 to-accent-400"}`}
                    style={{ width: `${Math.min(row.completionRate, 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-end text-[12px] font-extrabold text-foreground">
                  {row.completionRate}٪
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
