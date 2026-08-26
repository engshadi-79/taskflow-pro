"use client";

import { useOnlineStatus } from "@/lib/offline/use-online-status";

/**
 * Mounted once in src/app/m/layout.tsx (survives every navigation under
 * /m/**, same "single persistent owner" pattern as PresenceTracker in the
 * desktop dashboard layout) so a reconnect drains the offline mutation
 * queue regardless of which mobile page the user happens to be on.
 */
export function MobileOfflineSync() {
  useOnlineStatus();
  return null;
}
