"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { assignTrackProject } from "@/lib/actions/inventory";
import { InventoryDailyRow } from "@/components/dashboard/inventory-daily-row";
import { InventoryToolsManager } from "@/components/dashboard/inventory-tools-manager";
import type { InventoryDailyCheck, InventoryTool, InventoryTrack } from "@/lib/types/inventory";

type EmployeeOption = { id: string; full_name: string };
type TrackWithResponsible = InventoryTrack & { responsible: { id: string; full_name: string } | null };

/** One linked track's full inventory: tools admin (super_admin only) plus
 * the daily صباحي/مسائي/الكمية الفعلية grid, with a date picker for
 * browsing the full history - only today's row is ever editable. */
export function InventoryTrackPanel({
  track,
  tools,
  initialChecks,
  todayIso,
  isSuperAdmin,
  currentUserId,
  employees,
}: {
  track: TrackWithResponsible;
  tools: InventoryTool[];
  initialChecks: InventoryDailyCheck[];
  todayIso: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  employees: EmployeeOption[];
}) {
  const [date, setDate] = useState(todayIso);
  const [fetched, setFetched] = useState<{ date: string; checks: InventoryDailyCheck[] } | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  async function handleUnlink() {
    if (!confirm(`إلغاء ربط "${track.name}" بهذا المشروع؟`)) return;
    setUnlinking(true);
    await assignTrackProject(track.id, null);
    setUnlinking(false);
  }

  useEffect(() => {
    if (date === todayIso) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("inventory_daily_checks")
      .select("*")
      .eq("check_date", date)
      .in(
        "tool_id",
        tools.map((t) => t.id)
      )
      .returns<InventoryDailyCheck[]>()
      .then(({ data }) => {
        if (cancelled) return;
        setFetched({ date, checks: data ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, [date, todayIso, tools]);

  // "loading" is derived, not stored - the effect above never sets it
  // directly, it only records the result once the fetch for this exact
  // date resolves, so there's no separate flag to keep in sync.
  const loading = date !== todayIso && fetched?.date !== date;
  const checks = date === todayIso ? initialChecks : fetched?.date === date ? fetched.checks : [];
  const checkByToolId = new Map(checks.map((c) => [c.tool_id, c]));
  const isResponsible = track.responsible_user_id === currentUserId;
  const editable = date === todayIso && (isSuperAdmin || isResponsible);

  return (
    <div className="space-y-4.5">
      {isSuperAdmin && (
        <InventoryToolsManager track={track} tools={tools} employees={employees} />
      )}

      <div className="rounded-[18px] border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14.5px] font-extrabold text-foreground">جرد {track.name}</h3>
            {isSuperAdmin && (
              <button
                type="button"
                disabled={unlinking}
                onClick={handleUnlink}
                className="text-[11.5px] font-bold text-red-600 hover:underline disabled:opacity-60"
              >
                إلغاء الربط بهذا المشروع
              </button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-muted">التاريخ</span>
            <input
              type="date"
              value={date}
              max={todayIso}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
            />
          </label>
        </div>

        {tools.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">لا توجد أدوات في هذا المسار بعد</p>
        ) : loading ? (
          <p className="py-6 text-center text-[13px] text-muted">جارٍ التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="px-2 py-2 text-start">الأداة</th>
                  <th className="px-2 py-2 text-start">الكمية الكلية</th>
                  <th className="px-2 py-2 text-start">صباحي</th>
                  <th className="px-2 py-2 text-start">مسائي</th>
                  <th className="px-2 py-2 text-start">الكمية الفعلية</th>
                  {editable && <th className="px-2 py-2 text-start">حفظ</th>}
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <InventoryDailyRow
                    key={tool.id}
                    tool={tool}
                    check={checkByToolId.get(tool.id) ?? null}
                    date={date}
                    editable={editable}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
