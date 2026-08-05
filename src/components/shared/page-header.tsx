import { AnimatedBackground } from "@/components/shared/animated-background";

type Variant = "violet" | "teal" | "navy";

const BANNER: Record<Variant, string> = {
  violet: "banner-violet",
  teal: "banner-teal",
  navy: "banner-navy",
};

/**
 * The wide gradient banner that opens every page on the ACAS portal:
 * an icon tile, a title with a subtitle, and an optional action area.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  variant = "violet",
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: Variant;
  /** Short pill on the trailing edge, e.g. "106 نتيجة". */
  count?: string;
  /** Buttons or tabs rendered on the trailing edge. */
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`relative mb-6 overflow-hidden rounded-[20px] px-6 py-6 text-white shadow-lg shadow-accent-600/15 ${BANNER[variant]}`}
    >
      <AnimatedBackground intensity="subtle" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {icon && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/20 text-white backdrop-blur-sm">
              {icon}
            </span>
          )}
          <div>
            <h1 className="text-xl font-black sm:text-[26px]">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-[13px] font-medium text-white/80">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {children}
          {count && (
            <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-extrabold backdrop-blur-sm">
              {count}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** Translucent info chip for use inside a PageHeader. */
export function HeaderChip({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-bold backdrop-blur-sm">
      {icon}
      {children}
    </span>
  );
}
