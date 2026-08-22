import type { PerformanceRow } from "@/components/dashboard/performance-table";

// Cycled by row index whenever a chart doesn't supply its own `colorFor`
// (department/employee/project charts all used one flat accent color before,
// making every bar visually identical - only the priority chart had distinct
// per-row colors, via its own severity-based colorFor).
const DEFAULT_PALETTE = [
  "bg-gradient-to-l from-accent-600 to-accent-400",
  "bg-gradient-to-l from-teal-600 to-teal-500",
  "bg-gradient-to-l from-orange-600 to-orange-500",
  "bg-gradient-to-l from-pink-600 to-pink-500",
  "bg-gradient-to-l from-purple-600 to-purple-500",
  "bg-gradient-to-l from-green-600 to-green-500",
  "bg-gradient-to-l from-brand-blue-600 to-brand-blue-500",
  "bg-gradient-to-l from-brand-red-600 to-brand-red-500",
];

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
          {rows.map((row, index) => {
            const color = colorFor?.(row) ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
            return (
              <div key={row.key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12px] font-bold text-muted" title={row.name}>
                  {row.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${color}`}
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
