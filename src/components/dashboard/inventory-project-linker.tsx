"use client";

import { useState } from "react";
import { assignTrackProject } from "@/lib/actions/inventory";
import type { InventoryTrack } from "@/lib/types/inventory";

/** super_admin-only control on a project's "جرد الأدوات" tab: pick from
 * tracks not already linked to this project (unassigned, or linked
 * elsewhere) and attach one here. This is the only place a track's
 * project_id is set - there's no separate global inventory admin page. */
export function InventoryProjectLinker({
  projectId,
  availableTracks,
}: {
  projectId: string;
  availableTracks: InventoryTrack[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (availableTracks.length === 0) return null;

  async function handleLink() {
    if (!selected) return;
    setPending(true);
    setError(null);
    const result = await assignTrackProject(selected, projectId);
    setPending(false);
    if (result?.error) setError(result.error);
    else setSelected("");
  }

  return (
    <div className="flex flex-wrap items-end gap-2.5 rounded-[18px] border border-border bg-surface p-4">
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">ربط مسار جرد بهذا المشروع</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
        >
          <option value="">اختر مسارًا...</option>
          {availableTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!selected || pending}
        onClick={handleLink}
        className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "جارٍ الربط..." : "ربط"}
      </button>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
