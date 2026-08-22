"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Small accessible dialog: labelled, closes on Escape and backdrop click,
 * moves focus inside on open and restores it on close.
 */
export function Modal({
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
      // Only restore if that element still exists. When the dialog was opened
      // from a menu that unmounted, it does not, and the caller re-focuses a
      // stable trigger instead.
      const prev = restoreRef.current;
      if (prev?.isConnected) prev.focus();
    };
  }, [onClose]);

  // Portaled straight to <body>: some callers mount this several layers
  // deep inside overflow-hidden flex containers (the dashboard shell's
  // sidebar/content split), which clips a plain in-place `fixed` panel down
  // to whatever ancestor box actually has room instead of the full viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-border bg-surface shadow-2xl"
      >
        <div className="banner-violet px-5 py-4 text-white">
          <h2 className="text-[16px] font-black">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[12px] font-medium text-white/80">
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
