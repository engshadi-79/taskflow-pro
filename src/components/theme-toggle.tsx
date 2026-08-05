"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/shared/icons";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600 transition-colors hover:brightness-95"
      aria-pressed={isDark}
      aria-label={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
    >
      {isDark ? (
        <SunIcon className="h-[19px] w-[19px]" />
      ) : (
        <MoonIcon className="h-[19px] w-[19px]" />
      )}
    </button>
  );
}
