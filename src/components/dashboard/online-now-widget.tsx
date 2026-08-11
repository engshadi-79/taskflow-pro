"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BriefcaseIcon, UserIcon } from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

/**
 * Real presence, not a stored/derived number: every dashboard tab that has
 * this mounted tracks itself on a Supabase Realtime Presence channel keyed
 * by organization, so "متصلون الآن" always reflects who is actually on the
 * app in this exact moment - it disappears the instant a tab closes or the
 * connection drops, the same way Presence is designed to work.
 */
export function OnlineNowWidget({
  organizationId,
  userId,
  role,
}: {
  organizationId: string;
  userId: string;
  role: Role;
}) {
  const [managers, setManagers] = useState(0);
  const [employees, setEmployees] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // presence needs the session's JWT already attached to the socket -
    // same getSession()-before-channel guard used for the notifications
    // realtime subscription, to avoid a race on a freshly-loaded tab
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase.channel(`presence:org:${organizationId}`, {
        config: { presence: { key: userId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ role: Role }>();
          let m = 0;
          let e = 0;
          for (const presences of Object.values(state)) {
            const p = presences[0];
            if (!p) continue;
            if (p.role === "employee") e += 1;
            else m += 1;
          }
          setManagers(m);
          setEmployees(e);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel!.track({ role });
          }
        });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [organizationId, userId, role]);

  return (
    <div className="flex shrink-0 flex-col justify-center gap-2 rounded-[20px] border border-border bg-surface px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-foreground">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        متصلون الآن
      </p>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-background px-3 py-2">
          <BriefcaseIcon className="h-4 w-4 text-accent-600" />
          <b className="text-[15px] text-foreground">{managers}</b>
          <span className="text-[10.5px] font-bold text-faint">الإدارة</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-background px-3 py-2">
          <UserIcon className="h-4 w-4 text-accent-600" />
          <b className="text-[15px] text-foreground">{employees}</b>
          <span className="text-[10.5px] font-bold text-faint">الموظفون</span>
        </div>
      </div>
    </div>
  );
}
