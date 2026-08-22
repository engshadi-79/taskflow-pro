export type DepartmentHoursRow = { name: string; hours: number };

// Cycled by column index so each department reads as its own bar instead of
// one undifferentiated block of color - same palette as PerformanceBarChart,
// just the "to-t" (vertical) gradient direction this chart uses.
const BAR_PALETTE = [
  "bg-gradient-to-t from-accent-600 to-accent-400",
  "bg-gradient-to-t from-teal-600 to-teal-500",
  "bg-gradient-to-t from-orange-600 to-orange-500",
  "bg-gradient-to-t from-pink-600 to-pink-500",
  "bg-gradient-to-t from-purple-600 to-purple-500",
  "bg-gradient-to-t from-green-600 to-green-500",
  "bg-gradient-to-t from-brand-blue-600 to-brand-blue-500",
  "bg-gradient-to-t from-brand-red-600 to-brand-red-500",
];

/** Simple vertical bar chart — average completion time per department. */
export function DepartmentHoursChart({ rows }: { rows: DepartmentHoursRow[] }) {
  const max = Math.max(...rows.map((r) => r.hours), 1);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-5">
        <h4 className="text-[14.5px] font-extrabold text-foreground">أداء الأقسام</h4>
        <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
          متوسط وقت الإنجاز لكل قسم (بالساعات)
        </small>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
      ) : (
        // Fixed-width columns in a horizontally-scrollable strip instead of
        // flex-1 - with several departments, equal-share columns had no
        // min-w-0 floor, so each refused to shrink below its own (untruncated)
        // name's width and pushed the row past the screen edge.
        <div className="overflow-x-auto">
          <div className="flex h-[195px] items-end gap-3">
            {rows.map((row, index) => (
              <div key={row.name} className="flex w-[68px] shrink-0 flex-col items-center gap-2">
                <span className="text-[11px] font-extrabold text-foreground">{row.hours}</span>
                <div className="flex h-[130px] w-full items-end">
                  <div
                    className={`w-full rounded-t-md ${BAR_PALETTE[index % BAR_PALETTE.length]}`}
                    style={{ height: `${Math.max((row.hours / max) * 100, 4)}%` }}
                  />
                </div>
                {/* Two lines instead of one truncated line - most department
                    names are long enough that a single ellipsized line left
                    nothing recognizable. */}
                <span className="line-clamp-2 w-full text-center text-[10px] font-bold leading-tight text-muted">
                  {row.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
