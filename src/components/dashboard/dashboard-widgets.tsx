import Link from "next/link";
import { InboxIcon } from "@/components/shared/icons";

type KpiTone = "orange" | "pink" | "green" | "purple";

/**
 * Generic "list + see-all link" card, reused for Projects/Workload/any
 * other small ranked list on the dashboard - one shape instead of a
 * bespoke component per widget.
 */
export function MiniListPanel({
  title,
  caption,
  href,
  rows,
  emptyLabel,
}: {
  title: string;
  caption?: string;
  href: string;
  rows: { key: string; label: string; value: string }[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-[14.5px] font-extrabold text-foreground">{title}</h4>
          {caption && (
            <small className="mt-0.5 block text-[11.5px] font-medium text-faint">{caption}</small>
          )}
        </div>
        <Link href={href} className="text-[12px] font-bold text-accent-600 hover:underline">
          عرض الكل
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-faint">
            <InboxIcon className="h-4.5 w-4.5" />
          </span>
          <p className="text-[12.5px] text-muted">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="truncate font-semibold text-muted">{r.label}</span>
              <b className="shrink-0 font-extrabold text-foreground">{r.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KPI_GRADIENT: Record<KpiTone, string> = {
  orange: "from-orange-500 to-orange-600",
  pink: "from-pink-500 to-pink-600",
  green: "from-green-500 to-green-600",
  purple: "from-purple-500 to-purple-600",
};

export function KpiCard({
  tone,
  title,
  value,
  progress,
  foot,
}: {
  tone: KpiTone;
  title: string;
  value: string | number;
  progress: number;
  foot: string;
}) {
  return (
    <div
      className={`relative flex min-h-[135px] flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-br ${KPI_GRADIENT[tone]} p-[22px] text-white`}
    >
      <div className="absolute -bottom-5 -start-5 h-[90px] w-[90px] rounded-full bg-white/10" />
      <h3 className="relative z-2 text-[13.5px] font-bold opacity-95">{title}</h3>
      <div className="relative z-2 my-1.5 font-display text-[26px]">{value}</div>
      <div className="relative z-2 mb-2.5 h-[5px] rounded-md bg-white/30">
        <div
          className="h-full rounded-md bg-white"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      <div className="relative z-2 text-[11.5px] opacity-90">{foot}</div>
    </div>
  );
}

export function HeroCard({
  weekCount,
  deltaPercent,
  teamCompleted,
  teamPending,
}: {
  weekCount: number;
  deltaPercent: number;
  teamCompleted: number;
  teamPending: number;
}) {
  return (
    <div
      className="relative row-span-2 flex min-h-[300px] flex-col overflow-hidden rounded-[20px] p-[30px] pb-0 text-white"
      style={{ backgroundImage: "linear-gradient(135deg, var(--accent-500), #5C93FF)" }}
    >
      <h2 className="relative z-2 mb-2 font-display text-[19px]">إنجاز هذا الأسبوع</h2>
      <div className="relative z-2 mb-1.5 font-display text-[34px]">{weekCount} مهمة</div>
      <div className="relative z-2 mb-5.5 text-[12.5px] opacity-90">
        {deltaPercent >= 0 ? "▲" : "▼"} {Math.abs(deltaPercent)}٪ مقارنة بالأسبوع الماضي
      </div>
      <div className="relative z-2 mb-5.5 flex gap-8.5">
        <div>
          <span className="block text-xs opacity-85">مهام الفريق</span>
          <b className="font-display text-base">{teamCompleted} منجزة</b>
        </div>
        <div>
          <span className="block text-xs opacity-85">مهام معلّقة</span>
          <b className="font-display text-base">{teamPending} قيد التنفيذ</b>
        </div>
      </div>
      <a
        href="/dashboard/reports"
        className="relative z-2 mb-6 w-fit rounded-[9px] bg-[#FFC93C] px-5 py-2.5 text-[13px] font-extrabold text-[#1D1F2B]"
      >
        عرض التقرير الكامل
      </a>
    </div>
  );
}

const SEGMENT_COLORS = ["bg-accent-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-purple-500"];
const SEGMENT_DOT_COLORS = [
  "bg-accent-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-purple-500",
];

export function DistributionPanel({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: { label: string; count: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-[14.5px] font-extrabold text-foreground">{title}</h4>
          <small className="mt-0.5 block text-[11.5px] font-medium text-faint">{caption}</small>
        </div>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات كافية بعد</p>
      ) : (
        <>
          <div className="mb-3.5 flex h-[9px] overflow-hidden rounded-md">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                style={{ width: `${(row.count / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            {rows.map((row, i) => (
              <div key={row.label} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 font-semibold text-muted">
                  <span
                    className={`h-2 w-2 rounded-full ${SEGMENT_DOT_COLORS[i % SEGMENT_DOT_COLORS.length]}`}
                  />
                  {row.label}
                </span>
                <b className="font-extrabold text-foreground">
                  {Math.round((row.count / total) * 100)}٪
                </b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TrendPanel({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  const width = 320;
  const height = 130;
  const stepX = counts.length > 1 ? width / (counts.length - 1) : 0;
  const points = counts
    .map((c, i) => `${i * stepX},${height - (c / max) * (height - 20) - 10}`)
    .join(" ");
  const areaPoints = `${points} ${width},${height} 0,${height}`;
  const lastX = (counts.length - 1) * stepX;
  const lastY = height - (counts[counts.length - 1] / max) * (height - 20) - 10;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4">
        <h4 className="text-[14.5px] font-extrabold text-foreground">أداء الفريق</h4>
        <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
          المهام المنجزة آخر 7 أيام
        </small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-[130px] w-full">
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent-500)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline points={areaPoints} fill="var(--accent-500)" opacity="0.15" stroke="none" />
        <circle cx={lastX} cy={lastY} r="5" fill="var(--accent-500)" />
      </svg>
    </div>
  );
}

export function TopPerformerRow({
  name,
  subtitle,
  count,
  color,
}: {
  name: string;
  subtitle: string;
  count: number;
  color: string;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-none">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-extrabold text-white"
        style={{ background: color }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-bold text-foreground">{name}</b>
        <span className="text-[11.5px] text-faint">{subtitle}</span>
      </div>
      <div className="text-start text-[13px] font-extrabold text-foreground">
        {count}
        <small className="block font-medium text-faint">مهام</small>
      </div>
    </div>
  );
}

export function ActivityRow({
  description,
  actorName,
  timeAgo,
}: {
  description: string;
  actorName: string | null;
  timeAgo: string;
}) {
  return (
    <tr className="border-b border-border last:border-none">
      <td className="w-[46px] py-3.5 pe-1.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-accent-500 text-sm text-white">
          ✓
        </div>
      </td>
      <td className="py-3.5 pe-1.5">
        <b className="block text-[13px] font-bold text-foreground">{description}</b>
        {actorName && <span className="text-[11.5px] text-faint">{actorName}</span>}
      </td>
      <td className="py-3.5 pe-1.5 text-faint">{timeAgo}</td>
    </tr>
  );
}
