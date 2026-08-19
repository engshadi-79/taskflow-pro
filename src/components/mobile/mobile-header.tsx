"use client";

import { useRouter } from "next/navigation";

function BackButton({ light }: { light?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="رجوع"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        light ? "bg-white/15 text-white" : "bg-background text-foreground"
      }`}
    >
      <svg width="9" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/**
 * Two variants, matching the mockup: a full-bleed gradient "hero" header
 * (dashboard, task detail) when `gradient` is set, or a plain header (tasks,
 * kanban, notifications, ...) using the app's existing surface tokens.
 */
export function MobileHeader({
  title,
  subtitle,
  back,
  gradient,
  chips,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean;
  gradient?: string;
  chips?: React.ReactNode;
  action?: React.ReactNode;
}) {
  if (gradient) {
    return (
      <div className="px-4 pb-4 pt-[54px] text-white" style={{ backgroundImage: gradient }}>
        <div className="mb-3 flex items-center gap-2.5">
          {back && <BackButton light />}
          <span className="text-[13px] font-bold opacity-90">{subtitle}</span>
        </div>
        <div className="text-[17px] font-extrabold leading-snug">{title}</div>
        {chips && <div className="mt-2.5 flex flex-wrap gap-2">{chips}</div>}
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-background px-4 pb-2.5 pt-4">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {back && <BackButton />}
          <span className="text-[20px] font-extrabold text-foreground">{title}</span>
        </div>
        {action}
      </div>
      {subtitle && <p className="mt-1 text-[12.5px] font-medium text-muted">{subtitle}</p>}
    </div>
  );
}
