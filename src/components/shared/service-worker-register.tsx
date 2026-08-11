"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker (public/sw.js). Kept as its own
 * tiny client component so the root layout can stay a Server Component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // offline support is a nice-to-have, not a hard requirement - a
        // failed registration (e.g. unsupported browser) should never
        // block or break the app
      });
    }
  }, []);

  return null;
}
