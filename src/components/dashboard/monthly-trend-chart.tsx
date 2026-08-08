export type MonthlyTrendRow = { label: string; created: number; completed: number };

const WIDTH = 600;
const HEIGHT = 200;
const PAD = 10;

function linePoints(values: number[], max: number) {
  const stepX = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => `${PAD + i * stepX},${HEIGHT - PAD - (v / max) * (HEIGHT - PAD * 2)}`)
    .join(" ");
}

/** Two-series line chart — created vs completed tasks per month. */
export function MonthlyTrendChart({ rows }: { rows: MonthlyTrendRow[] }) {
  const max = Math.max(...rows.map((r) => r.created), ...rows.map((r) => r.completed), 1);
  const createdPoints = linePoints(
    rows.map((r) => r.created),
    max
  );
  const completedPoints = linePoints(
    rows.map((r) => r.completed),
    max
  );

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-[14.5px] font-extrabold text-foreground">اتجاهات الأداء</h4>
          <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
            مقارنة بين المهام المضافة والمنجزة شهريًا
          </small>
        </div>
        <div className="flex items-center gap-3.5 text-[11.5px] font-bold">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            المهام المنجزة
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            المهام المضافة
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
      ) : (
        // The line itself is plain SVG geometry - x always increases
        // left-to-right regardless of page direction - but the month labels
        // below it are a plain flex row, which the page's RTL direction
        // would otherwise reverse, putting the oldest month on the right
        // under a line that still reads oldest-to-newest left-to-right.
        // Pinning this whole block to ltr keeps both in sync.
        <div dir="ltr">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="mt-3 block h-[180px] w-full"
          >
            <polyline
              points={createdPoints}
              fill="none"
              stroke="var(--purple-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
            />
            <polyline
              points={completedPoints}
              fill="none"
              stroke="var(--accent-500)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex justify-between text-[10.5px] text-faint">
            {rows.map((r) => (
              <span key={r.label}>{r.label}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
