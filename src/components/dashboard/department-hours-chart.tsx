export type DepartmentHoursRow = { name: string; hours: number };

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
        <div className="flex h-[180px] items-end gap-3">
          {rows.map((row) => (
            <div key={row.name} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-extrabold text-foreground">{row.hours}</span>
              <div className="flex h-[130px] w-full items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-accent-600 to-accent-400"
                  style={{ height: `${Math.max((row.hours / max) * 100, 4)}%` }}
                />
              </div>
              <span className="w-full truncate text-center text-[11px] font-bold text-muted">
                {row.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
