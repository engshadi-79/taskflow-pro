"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types/roles";

/**
 * Mounted once in the dashboard layout (not the home page) so a user's
 * presence stays live on every /dashboard/** route, not just while they
 * happen to be on the dashboard home page - OnlineNowWidget only ever
 * *reads* this same channel's state, it never tracks its own presence, so
 * there's exactly one place writing presence per user.
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

  // temporary diagnostic: confirms the component itself renders with valid
  // props, decoupled from whether the effect below ever runs
  console.log("[presence-tracker] render", { organizationId, userId, fullName, role });

  useEffect(() => {
    console.log("[presence-tracker] effect running");
    const supabase = createClient();

    // NOT gated behind auth.getSession() here, unlike the notification bell's
    // channel - with three components on one page each independently
    // awaiting getSession() concurrently on mount (this one, OnlineNowWidget,
    // NotificationBell), the auth client's session lock only ever resolved
    // for one of them and the other two hung forever with no error. The
    // realtime client attaches the auth token via its own onAuthStateChange
    // listener regardless, so waiting for it here was redundant, not required.
    const channel = supabase.channel(`presence:org:${organizationId}`, {
      config: { presence: { key: userId } },
    });

    channel.subscribe((status, err) => {
      // temporary diagnostics for the "employees always shows 0" report -
      // remove once presence is confirmed working end to end
      console.log("[presence-tracker] subscribe status:", status, err ?? "");
      if (status === "SUBSCRIBED") {
        channel
          .track({ userId, fullName, role, departmentName, avatarUrl, pathname })
          .then((trackStatus) => console.log("[presence-tracker] track status:", trackStatus));
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
