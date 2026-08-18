"use client";

import { useState } from "react";
import { InventoryTrackPanel } from "@/components/dashboard/inventory-track-panel";
import { INVENTORY_THEME_VARS } from "@/lib/inventory-status";
import type { InventoryDailyCheck, InventoryTool, InventoryTrack } from "@/lib/types/inventory";

type EmployeeOption = { id: string; full_name: string };
type TrackWithResponsible = InventoryTrack & { responsible: { id: string; full_name: string } | null };

/** Best-effort icon per track name - purely cosmetic, falls back to a
 * generic mark for any track name that doesn't match a known keyword. */
function trackIcon(name: string) {
  if (name.includes("حلاقة")) return "💈";
  if (name.includes("تجميل") || name.includes("كوافير")) return "💄";
  if (name.includes("تطريز") || name.includes("خياطة")) return "🧵";
  if (name.includes("اكسسوار") || name.includes("أشغال")) return "✨";
  if (name.includes("ترجمة") || name.includes("رقمي")) return "💻";
  return "📦";
}

/** Track selector as real tabs - only the active track's panel is
 * rendered, matching the reference design (a project can have several
 * linked tracks, but they were never meant to all show at once). */
export function InventoryTrackTabs({
  tracks,
  toolsByTrack,
  checksByTrack,
  todayIso,
  isSuperAdmin,
  currentUserId,
  employees,
}: {
  tracks: TrackWithResponsible[];
  toolsByTrack: Record<string, InventoryTool[]>;
  checksByTrack: Record<string, InventoryDailyCheck[]>;
  todayIso: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  employees: EmployeeOption[];
}) {
  const [activeId, setActiveId] = useState(tracks[0]?.id);
  const active = tracks.find((t) => t.id === activeId) ?? tracks[0];

  return (
    <div style={INVENTORY_THEME_VARS} className="space-y-4">
      <div className="overflow-x-auto rounded-[14px] bg-gradient-to-br from-[var(--inv-emerald-950)] to-[var(--inv-emerald-800)] p-2">
        <div className="flex gap-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => setActiveId(track.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[12px] px-4 py-2.5 font-display text-[13px] font-bold transition-colors ${
                track.id === active?.id
                  ? "bg-[var(--inv-gold)] text-[var(--inv-emerald-950)]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.11] hover:text-white"
              }`}
            >
              <span>{trackIcon(track.name)}</span>
              {track.name}
              <span className="text-[10.5px] opacity-75">({(toolsByTrack[track.id] ?? []).length})</span>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <InventoryTrackPanel
          key={active.id}
          track={active}
          tools={toolsByTrack[active.id] ?? []}
          initialChecks={checksByTrack[active.id] ?? []}
          todayIso={todayIso}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUserId}
          employees={employees}
        />
      )}
    </div>
  );
}
