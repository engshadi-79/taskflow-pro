import Link from "next/link";

export type StatTone = "red" | "indigo" | "green" | "blue" | "amber" | "violet" | "teal";

/** Top rule, icon tint and number colour per tone — the ACAS stat-card signature. */
const TONE: Record<StatTone, { bar: string; tint: string; num: string }> = {
  red: {
    bar: "bg-brand-red-500",
    tint: "bg-brand-red-50 text-brand-red-500",
    num: "text-brand-red-500",
  },
  indigo: {
    bar: "bg-accent-600",
    tint: "bg-accent-50 text-accent-600",
    num: "text-accent-600",
  },
  green: {
    bar: "bg-green-500",
    tint: "bg-green-50 text-green-500",
    num: "text-green-500",
  },
  blue: {
    bar: "bg-brand-blue-500",
    tint: "bg-brand-blue-50 text-brand-blue-600",
    num: "text-brand-blue-600",
  },
  amber: {
    bar: "bg-orange-500",
    tint: "bg-orange-50 text-orange-600",
    num: "text-orange-600",
  },
  violet: {
    bar: "bg-purple-500",
    tint: "bg-purple-50 text-purple-500",
    num: "text-purple-500",
  },
  teal: {
    bar: "bg-teal-500",
    tint: "bg-teal-50 text-teal-500",
    num: "text-teal-500",
  },
};

export function StatCard({
  value,
  label,
  icon,
  tone = "indigo",
  href,
}: {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  href?: string;
}) {
  const t = TONE[tone];

  const body = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      {icon && (
        <span
          className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${t.tint}`}
        >
          {icon}
        </span>
      )}
      <div className={`text-[30px] font-black leading-none ${t.num}`}>{value}</div>
      <div className="mt-1.5 text-[12.5px] font-bold text-muted">{label}</div>
    </>
  );

  const shell =
    "relative flex flex-col items-center overflow-hidden rounded-[16px] border border-border bg-surface px-4 pb-5 pt-6 text-center shadow-sm";

  if (href) {
    return (
      <Link
        href={href}
        className={`${shell} transition-all hover:-translate-y-0.5 hover:shadow-md`}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
