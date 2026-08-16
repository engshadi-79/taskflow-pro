import Link from "next/link";
import { AlertIcon, CheckCircleIcon, InfoIcon } from "@/components/shared/icons";
import { SEVERITY_LABEL, type Insight } from "@/lib/types/decisions";

const SEVERITY_STYLE: Record<Insight["severity"], { border: string; badge: string; icon: React.ReactNode }> = {
  critical: {
    border: "border-s-brand-red-500",
    badge: "bg-brand-red-50 text-brand-red-600",
    icon: <AlertIcon className="h-4 w-4" />,
  },
  warning: {
    border: "border-s-orange-500",
    badge: "bg-orange-50 text-orange-600",
    icon: <AlertIcon className="h-4 w-4" />,
  },
  good: {
    border: "border-s-green-500",
    badge: "bg-green-50 text-green-600",
    icon: <CheckCircleIcon className="h-4 w-4" />,
  },
  info: {
    border: "border-s-accent-500",
    badge: "bg-accent-50 text-accent-600",
    icon: <InfoIcon className="h-4 w-4" />,
  },
};

/** One "ماذا حدث / لماذا / ما الإجراء" card - see src/lib/decisions/insights.ts. */
export function InsightCard({ insight }: { insight: Insight }) {
  const style = SEVERITY_STYLE[insight.severity];

  return (
    <div className={`rounded-[18px] border-s-[4px] border border-border bg-surface p-5 ${style.border}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${style.badge}`}>
          {style.icon}
          {SEVERITY_LABEL[insight.severity]}
        </span>
      </div>
      <h3 className="mb-1.5 font-display text-[15px] text-foreground">{insight.title}</h3>
      <p className="mb-3.5 text-[13px] leading-6 text-muted">{insight.explanation}</p>
      <Link
        href={insight.action_href}
        className="inline-flex items-center gap-1 text-[12.5px] font-bold text-accent-600 hover:underline"
      >
        {insight.action_label} ←
      </Link>
    </div>
  );
}
