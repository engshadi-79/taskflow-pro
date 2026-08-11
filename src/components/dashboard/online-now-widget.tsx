"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/shared/avatar";
import { Modal } from "@/components/shared/modal";
import { BriefcaseIcon, RefreshIcon, UserIcon } from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

type PresenceEntry = {
  userId: string;
  fullName: string;
  role: Role;
  departmentName: string | null;
  avatarUrl: string | null;
  pathname: string;
};

/**
 * Read-only: PresenceTracker (mounted once in the dashboard layout, so it
 * survives navigating between pages) is the only thing that ever calls
 * track() on this channel. This just listens, so "متصلون الآن" reflects
 * whoever is on ANY /dashboard/** page right now, not only this one - it
 * disappears the instant a tab closes or the connection drops, the same
 * way Presence is designed to work.
 */
export function OnlineNowWidget({ organizationId }: { organizationId: string }) {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [openGroup, setOpenGroup] = useState<"management" | "employees" | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // presence needs the session's JWT already attached to the socket -
    // same getSession()-before-channel guard used for the notifications
    // realtime subscription, to avoid a race on a freshly-loaded tab
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase.channel(`presence:org:${organizationId}`);

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<Partial<PresenceEntry>>();
          // temporary diagnostics for the "employees always shows 0" report -
          // remove once presence is confirmed working end to end
          console.debug("[online-now-widget] presence sync, raw state:", state);
          // another open tab can still be running an older deploy that
          // tracked fewer fields (e.g. just {role}) - normalize every
          // entry so a stale/partial payload from someone else's browser
          // never crashes rendering here
          setEntries(
            Object.values(state)
              .map((presences) => presences[0])
              .filter(Boolean)
              .map((p) => ({
                userId: p.userId ?? "",
                fullName: p.fullName ?? "مستخدم",
                role: p.role ?? "employee",
                departmentName: p.departmentName ?? null,
                avatarUrl: p.avatarUrl ?? null,
                pathname: p.pathname ?? "",
              }))
          );
          setLastSync(new Date());
        })
        .subscribe((status, err) => {
          console.debug("[online-now-widget] subscribe status:", status, err ?? "");
        });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const management = entries.filter((e) => e.role !== "employee");
  const employees = entries.filter((e) => e.role === "employee");

  return (
    <>
      <div className="flex shrink-0 flex-col justify-center gap-2 rounded-[20px] border border-border bg-surface px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          متصلون الآن
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenGroup("management")}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-accent-50"
          >
            <BriefcaseIcon className="h-4 w-4 text-accent-600" />
            <b className="text-[15px] text-foreground">{management.length}</b>
            <span className="text-[10.5px] font-bold text-faint">الإدارة</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenGroup("employees")}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-accent-50"
          >
            <UserIcon className="h-4 w-4 text-accent-600" />
            <b className="text-[15px] text-foreground">{employees.length}</b>
            <span className="text-[10.5px] font-bold text-faint">الموظفون</span>
          </button>
        </div>
      </div>

      {openGroup && (
        <OnlineListModal
          title={openGroup === "management" ? "المتصلون من الإدارة" : "المتصلون من الموظفين"}
          entries={openGroup === "management" ? management : employees}
          lastSync={lastSync}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </>
  );
}

function OnlineListModal({
  title,
  entries,
  lastSync,
  onClose,
}: {
  title: string;
  entries: PresenceEntry[];
  lastSync: Date | null;
  onClose: () => void;
}) {
  return (
    <Modal title={title} subtitle={`${entries.length} متصل الآن`} onClose={onClose}>
      <div className="space-y-2.5">
        {entries.length === 0 && <p className="text-sm text-muted">لا يوجد أحد متصل حاليًا</p>}

        {entries.map((e) => (
          <div key={e.userId} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5">
            <Avatar src={e.avatarUrl} name={e.fullName} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-foreground">{e.fullName}</p>
              <p className="truncate text-[11.5px] text-faint">
                {ROLE_LABEL[e.role]}
                {e.departmentName && ` — ${e.departmentName}`}
              </p>
              <p className="truncate text-[10.5px] text-muted">{e.pathname}</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              الآن
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-faint">
          <RefreshIcon className="h-3 w-3" />
          يتحدّث لحظيًا — آخر تغيير: {lastSync ? lastSync.toLocaleTimeString("ar") : "—"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-foreground hover:bg-background"
        >
          إغلاق
        </button>
      </div>
    </Modal>
  );
}
