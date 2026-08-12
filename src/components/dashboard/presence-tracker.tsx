"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types/roles";

export type PresenceEntry = {
  userId: string;
  fullName: string;
  role: Role;
  departmentName: string | null;
  avatarUrl: string | null;
  pathname: string;
};

export const PRESENCE_SYNC_EVENT = "monjez:presence-sync";

/**
 * Mounted once in the dashboard layout (survives every route change under
 * /dashboard/**) and is the ONLY thing that ever opens a channel on
 * `presence:org:<id>` - two separate components each calling
 * supabase.channel() with the exact same topic name turned out to only let
 * the first one's subscribe() callback ever fire; the second's (this
 * component, in the earlier version) simply never got invoked, so its
 * track() call never ran. Rather than rely on that being safe, this is now
 * the single owner: it tracks itself AND rebroadcasts the synced state as a
 * plain `window` CustomEvent, which OnlineNowWidget just listens for - no
 * second channel, no ambiguity about which one "wins" the topic.
 */
export function PresenceTracker({
  organizationId,
  userId,
  fullName,
  role,
  departmentName,
  avatarUrl,
}: {
  organizationId: string;
  userId: string;
  fullName: string;
  role: Role;
  departmentName: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:org:${organizationId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Partial<PresenceEntry>>();
        const entries: PresenceEntry[] = Object.values(state)
          .map((presences) => presences[0])
          .filter(Boolean)
          .map((p) => ({
            userId: p.userId ?? "",
            fullName: p.fullName ?? "مستخدم",
            role: p.role ?? "employee",
            departmentName: p.departmentName ?? null,
            avatarUrl: p.avatarUrl ?? null,
            pathname: p.pathname ?? "",
          }));
        window.dispatchEvent(new CustomEvent<PresenceEntry[]>(PRESENCE_SYNC_EVENT, { detail: entries }));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ userId, fullName, role, departmentName, avatarUrl, pathname });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // re-tracking on every pathname change keeps "current page" fresh for
    // anyone viewing the online-now list, without a manual refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, pathname]);

  return null;
}
