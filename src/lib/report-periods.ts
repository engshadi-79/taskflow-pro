export type ReportPeriod = "week" | "month" | "quarter";

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  week: "هذا الأسبوع",
  month: "الشهر الحالي",
  quarter: "الربع الحالي",
};

export function parsePeriod(value: string | undefined): ReportPeriod {
  return value === "month" || value === "quarter" ? value : "week";
}

/**
 * `current`/`previous` are equal-length windows, so a delta between their
 * totals compares like with like (e.g. this week vs the 7 days before it).
 * "week" is a rolling 7-day window to match the same convention the
 * dashboard home page already uses; month/quarter are calendar-aligned,
 * since "current month" only means one thing.
 */
export function periodRange(period: ReportPeriod, now: Date = new Date()) {
  if (period === "week") {
    const since = new Date(now.getTime() - 7 * 86400000);
    const prevSince = new Date(now.getTime() - 14 * 86400000);
    return { since, until: now, prevSince, prevUntil: since };
  }

  if (period === "month") {
    const since = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevSince = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { since, until: now, prevSince, prevUntil: since };
  }

  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const since = new Date(now.getFullYear(), quarterStartMonth, 1);
  const prevSince = new Date(now.getFullYear(), quarterStartMonth - 3, 1);
  return { since, until: now, prevSince, prevUntil: since };
}

export function pctDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** YYYY-MM-DD in local time, matching how Postgres `date` values compare. */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
