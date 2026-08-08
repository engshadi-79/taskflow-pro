import { MiniSparkline } from "@/components/dashboard/mini-sparkline";

export type ReportStatTone = "red" | "blue" | "green" | "amber";

const TONE: Record<ReportStatTone, { icon: string; value: string; bar: string; spark: string }> = {
  red: {
    icon: "bg-brand-red-50 text-brand-red-500",
    value: "text-brand-red-500",
    bar: "bg-brand-red-500",
    spark: "var(--red-500)",
  },
  blue: {
    icon: "bg-brand-blue-50 text-brand-blue-600",
    value: "text-foreground",
    bar: "bg-brand-blue-500",
    spark: "var(--blue-500)",
  },
  green: {
    icon: "bg-green-50 text-green-500",
    value: "text-green-500",
    bar: "bg-green-500",
    spark: "var(--green-500)",
  },
  amber: {
    icon: "bg-orange-50 text-orange-600",
    value: "text-orange-600",
    bar: "bg-orange-500",
    spark: "var(--orange-500)",
  },
};

export function ReportStatCard({
  label,
  value,
  icon,
  tone,
  deltaPercent,
  deltaLabel,
  sparkline,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: ReportStatTone;
  /** Omit when there's nothing honest to compare against (e.g. a live snapshot count). */
  deltaPercent?: number;
  deltaLabel?: string;
  sparkline?: number[];
}) {
  const t = TONE[tone];
  const up = (deltaPercent ?? 0) >= 0;

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border bg-surface p-4">
      <span className={`absolute inset-y-0 start-0 w-1 ${t.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          {icon}
        </span>
        {deltaPercent !== undefined && (
          <span
            className={`text-[11px] font-bold ${up ? "text-green-600" : "text-brand-red-500"}`}
          >
            {up ? "▲" : "▼"} {Math.abs(deltaPercent)}٪
          </span>
        )}
      </div>

      <div className={`mt-3 font-display text-[26px] leading-none ${t.value}`}>{value}</div>
      <div className="mt-1 text-[12.5px] font-bold text-muted">{label}</div>

      {sparkline && sparkline.length > 1 ? (
        <div className="mt-2">
          <MiniSparkline values={sparkline} color={t.spark} />
        </div>
      ) : (
        deltaLabel && <div className="mt-2.5 text-[11px] text-faint">{deltaLabel}</div>
      )}
    </div>
  );
}
