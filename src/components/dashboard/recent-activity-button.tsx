"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format-time-ago";
import {
  CalendarIcon,
  ChatIcon,
  CheckSquareIcon,
  ClockIcon,
  FolderIcon,
  RefreshIcon,
} from "@/components/shared/icons";

const PANEL_LIMIT = 30;

type ActivityRow = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
};

type Meta = { tint: string; icon: React.ReactNode };

const ENTITY_META: Record<string, Meta> = {
  task: { tint: "bg-accent-500", icon: <CheckSquareIcon className="h-[16px] w-[16px]" /> },
  meeting: { tint: "bg-orange-500", icon: <CalendarIcon className="h-[16px] w-[16px]" /> },
  project: { tint: "bg-purple-500", icon: <FolderIcon className="h-[16px] w-[16px]" /> },
  knowledge_article: { tint: "bg-teal-500", icon: <FolderIcon className="h-[16px] w-[16px]" /> },
  comment: { tint: "bg-blue-500", icon: <ChatIcon className="h-[16px] w-[16px]" /> },
};

const FALLBACK: Meta = { tint: "bg-muted", icon: <ClockIcon className="h-[16px] w-[16px]" /> };

function metaFor(entityType: string): Meta {
  return ENTITY_META[entityType] ?? FALLBACK;
}

export function RecentActivityButton({
  userId,
  initialCount,
}: {
  userId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("activity_log")
      .select("id, action_type, entity_type, entity_id, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PANEL_LIMIT)
      .returns<ActivityRow[]>();
    setItems(data ?? []);
    setCount(data?.length ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) load();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-[12.5px] font-bold text-foreground transition-colors hover:bg-accent-50"
      >
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-extrabold text-white">
          {count}
        </span>
        <RefreshIcon className="h-3.5 w-3.5 text-muted" />
        آخر أنشطتي
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="آخر أنشطتي"
          className="absolute end-0 top-[calc(100%+10px)] z-40 w-[min(92vw,480px)] overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-[13.5px] font-black text-foreground">آخر أنشطتي</span>
            <span className="text-[11px] font-medium text-faint">{items?.length ?? 0} نشاط</span>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-[13px] text-muted">جارٍ التحميل...</p>
            )}

            {!loading && items?.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-muted">لا توجد أنشطة بعد</p>
            )}

            {!loading &&
              items?.map((item) => {
                const meta = metaFor(item.entity_type);
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${meta.tint}`}
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[12.5px] font-bold text-foreground">
                        {item.description ?? item.action_type}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        <ClockIcon className="h-3 w-3" />
                        {timeAgo(item.created_at)}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
