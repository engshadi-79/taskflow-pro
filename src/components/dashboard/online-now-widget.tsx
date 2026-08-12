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
      <div className="w-full max-w-[220px] shrink-0 rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-white p-4 shadow-sm dark:border-green-900/40 dark:from-green-950/20 dark:via-surface dark:to-surface">
        <p className="mb-3 text-center text-[13px] font-extrabold text-foreground">متصلون الآن</p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full flex-col items-center gap-1.5 rounded-xl bg-surface px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <UsersIcon className="h-5 w-5" />
          </span>
          <b
            className={`text-[22px] leading-none text-green-600 transition-transform duration-300 ${
              bump ? "scale-125" : "scale-100"
            }`}
          >
            {entries.length}
          </b>
          <span className="text-[11.5px] font-bold text-muted">متصل الآن</span>
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] text-faint">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          اضغط الأيقونة لعرض الأسماء
        </p>
      </div>

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
