import { STATUS_LABEL, type TaskStatus } from "@/lib/types/task";

const STATUS_COLOR: Record<TaskStatus, string> = {
  new: "#94a3b8",
  in_progress: "#6366f1",
  pending_review: "#f59e0b",
  completed: "#16a34a",
  overdue: "#dc3545",
  cancelled: "#cbd5e1",
};

const R = 60;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Donut chart built from stroke-dasharray segments — no charting library. */
export function StatusDonutChart({
  rows,
}: {
  rows: { status: TaskStatus; count: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  // reduce() rather than a mutated running total: render must stay a pure
  // function of props, with no captured variable reassigned along the way.
  const segments = rows.reduce<{ row: (typeof rows)[number]; dash: number; offset: number }[]>(
    (acc, row) => {
      const dash = (row.count / total) * CIRCUMFERENCE;
      const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      return [...acc, { row, dash, offset: prevOffset }];
    },
    []
  );

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4">
        <h4 className="text-[14.5px] font-extrabold text-foreground">حالة المهام النشطة</h4>
        <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
          نظرة عامة على جميع المهام الحالية
        </small>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
          <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--border)" strokeWidth="16" />
            {segments.map(({ row, dash, offset }) => (
              <circle
                key={row.status}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={STATUS_COLOR[row.status]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
              />
            ))}
          </svg>

          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.status} className="flex items-center gap-2 text-[12.5px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLOR[row.status] }}
                />
                <span className="font-bold text-muted">{STATUS_LABEL[row.status]}</span>
                <span className="font-extrabold text-foreground">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
