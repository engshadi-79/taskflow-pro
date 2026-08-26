import { useEffect, useSyncExternalStore } from "react";
import { syncPendingMutations } from "@/lib/offline/sync";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/**
 * Same useSyncExternalStore approach as theme-toggle.tsx (a synchronous
 * setState read of navigator.onLine inside a plain useEffect is flagged by
 * react-hooks/set-state-in-effect even for one-time mount sync). Draining
 * the offline queue on every reconnect is a side effect, not render state,
 * so it stays in its own effect keyed on the resulting boolean - this fires
 * once on mount if already online, and again on every offline -> online
 * transition.
 */
export function useOnlineStatus(): boolean {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (isOnline) void syncPendingMutations();
  }, [isOnline]);

  return isOnline;
}
