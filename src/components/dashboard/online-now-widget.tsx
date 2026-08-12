"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Modal } from "@/components/shared/modal";
import { RefreshIcon, UsersIcon } from "@/components/shared/icons";
import { PRESENCE_SYNC_EVENT, type PresenceEntry } from "@/components/dashboard/presence-tracker";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

/**
 * Read-only: PresenceTracker (mounted once in the dashboard layout) owns
 * the actual Realtime Presence channel and rebroadcasts synced state as a
 * window CustomEvent - this just listens, so "متصلون الآن" reflects
 * whoever is on ANY /dashboard/** page right now, not only this one.
 */
export function OnlineNowWidget() {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    function onSync(e: Event) {
      const next = (e as CustomEvent<PresenceEntry[]>).detail;
      setEntries((prev) => {
        if (prev.length !== next.length) {
          setBump(true);
          window.setTimeout(() => setBump(false), 420);
        }
        return next;
      });
      setLastSync(new Date());
    }
    window.addEventListener(PRESENCE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(PRESENCE_SYNC_EVENT, onSync);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-[20px] border border-border bg-surface px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-lg hover:shadow-accent-500/10"
      >
        <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-accent-500 to-purple-500" />
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-purple-500 text-white shadow-sm transition-transform group-hover:scale-105">
          <UsersIcon className="h-5 w-5" />
        </span>
        <span className="text-start">
          <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            متصلون الآن
          </span>
          <b
            className={`mt-0.5 block text-[18px] text-foreground transition-transform duration-300 ${
              bump ? "scale-125 text-accent-600" : "scale-100"
            }`}
          >
            {entries.length}
          </b>
        </span>
      </button>

      {open && <OnlineListModal entries={entries} lastSync={lastSync} onClose={() => setOpen(false)} />}
    </>
  );
}

function OnlineListModal({
  entries,
  lastSync,
  onClose,
}: {
  entries: PresenceEntry[];
  lastSync: Date | null;
  onClose: () => void;
}) {
  return (
    <Modal title="المتصلون الآن" subtitle={`${entries.length} متصل`} onClose={onClose}>
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
