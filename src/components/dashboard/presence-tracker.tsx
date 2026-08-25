"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:org:${organizationId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;

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
          subscribedRef.current = true;
          channel.track({ userId, fullName, role, departmentName, avatarUrl, pathname });
        }
      });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // Keyed only on (organizationId, userId) - deliberately NOT on pathname.
    // This used to also re-run on every navigation, tearing the channel down
    // and opening a fresh one on the exact same `presence:org:<id>` topic;
    // that race (old unsubscribe still in flight while the new one
    // subscribes) was the same class of bug described above for two
    // simultaneous owners, and left the widget stuck showing 0 after any
    // navigation (e.g. right after adding a user) until a full page reload.
    // Pathname updates now go through track() below on the same long-lived
    // channel instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId]);

  useEffect(() => {
    if (!subscribedRef.current || !channelRef.current) return;
    channelRef.current.track({ userId, fullName, role, departmentName, avatarUrl, pathname });
  }, [pathname, userId, fullName, role, departmentName, avatarUrl]);

  return null;
}
