import Link from "next/link";
import { PERIOD_LABEL, type ReportPeriod } from "@/lib/report-periods";

const PERIODS: ReportPeriod[] = ["week", "month", "quarter"];

/** Plain links carrying ?period=, so the filter works without client JS and
 * is shareable/bookmarkable like any other server-rendered page state. */
export function PeriodTabs({
  active,
  basePath = "/dashboard/reports",
}: {
  active: ReportPeriod;
  basePath?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={p === "week" ? basePath : `${basePath}?period=${p}`}
          className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
            active === p
              ? "bg-accent-600 text-white"
              : "border border-border bg-surface text-muted hover:bg-background"
          }`}
        >
          {PERIOD_LABEL[p]}
        </Link>
      ))}
    </div>
  );
}
