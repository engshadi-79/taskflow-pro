"use client";

import { computeInventoryStatus, INVENTORY_BADGE_CLASS } from "@/lib/inventory-status";
import type { InventoryTool } from "@/lib/types/inventory";

export type DailyCheckValue = { morning: boolean; evening: boolean; actual: string };

/** Purely controlled - the parent panel owns the actual check state (it
 * needs it anyway for the live summary ring/stat cards), this just renders
 * one row and reports interactions upward. */
export function InventoryDailyRow({
  index,
  tool,
  value,
  editable,
  onChange,
  error,
}: {
  index: number;
  tool: InventoryTool;
  value: DailyCheckValue;
  editable: boolean;
  onChange: (field: "morning" | "evening" | "actual", value: boolean | string) => void;
  error?: string | null;
}) {
  const status = computeInventoryStatus(tool.total_quantity, {
    morning_checked: value.morning,
    evening_checked: value.evening,
    actual_quantity: value.actual || null,
  });

  return (
    <tr className="border-b border-[var(--inv-line,#e4e0d2)] transition-colors last:border-b-0 hover:bg-black/[0.02]">
      <td className="px-2.5 py-2.5 text-center text-[12.5px] text-muted">{index + 1}</td>
      <td className="px-2.5 py-2.5 text-start">
        <div className="text-[13.5px] font-medium text-foreground">{tool.name}</div>
        {tool.unit && <span className="block text-[10.5px] text-faint">{tool.unit}</span>}
      </td>
      <td className="px-2.5 py-2.5 text-center font-display text-[13px] font-bold text-[var(--inv-emerald-900)]">
        {tool.total_quantity ?? "—"}
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="checkbox"
          checked={value.morning}
          disabled={!editable}
          onChange={(e) => onChange("morning", e.target.checked)}
          className="h-[19px] w-[19px] cursor-pointer accent-[var(--inv-emerald-700)] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="checkbox"
          checked={value.evening}
          disabled={!editable}
          onChange={(e) => onChange("evening", e.target.checked)}
          className="h-[19px] w-[19px] cursor-pointer accent-[var(--inv-emerald-700)] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={value.actual}
          disabled={!editable}
          onChange={(e) => onChange("actual", e.target.value)}
          placeholder="—"
          className="w-16 rounded-lg border border-[var(--inv-line,#e4e0d2)] px-1.5 py-1.5 text-center text-[13px] outline-none focus:border-[var(--inv-emerald-700)] disabled:opacity-50"
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <span className={`inline-block rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${INVENTORY_BADGE_CLASS[status.tone]}`}>
          {status.label}
        </span>
        {error && <p className="mt-1 text-[10.5px] text-[var(--inv-bad)]">{error}</p>}
      </td>
    </tr>
  );
}
