"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/shared/icons";

/**
 * Same accessibility contract as Modal (focus trap entry, Escape/backdrop to
 * close, scroll lock, focus restore) but docked to the screen's right edge
 * and sliding in, for settings that read better as a dedicated panel than a
 * centered dialog.
 */
export function SidePanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      "input, button, select, textarea, [href]"
    );
    focusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      const prev = restoreRef.current;
      if (prev?.isConnected) prev.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-in-end absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-hidden border-s border-border bg-surface shadow-2xl"
      >
        <div className="banner-violet flex shrink-0 items-start justify-between gap-3 px-5 py-4 text-white">
          <div>
            <h2 className="text-[16px] font-black">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] font-medium text-white/80">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="shrink-0 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
