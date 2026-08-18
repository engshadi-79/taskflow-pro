"use client";

import { computeConsumableRemaining, computeFixedStatus, INVENTORY_BADGE_CLASS } from "@/lib/inventory-status";
import type { InventoryTool } from "@/lib/types/inventory";

export type FixedCheckValue = { found: string; notes: string };
export type ConsumableCheckValue = { opening: string; used: string; damaged: string; notes: string };

const cellInput =
  "w-20 rounded-lg border border-[var(--inv-line,#e4e0d2)] px-1.5 py-1.5 text-center text-[13px] outline-none focus:border-[var(--inv-emerald-700)] disabled:opacity-50";
const notesInput =
  "w-full min-w-[100px] rounded-lg border border-[var(--inv-line,#e4e0d2)] px-1.5 py-1.5 text-center text-[12px] outline-none focus:border-[var(--inv-emerald-700)] disabled:opacity-50";

/** الأدوات الثابتة: الرصيد السابق (tool.total_quantity, ثابت) مقابل
 * الموجود فعليًا (يُدخَل يوميًا) - لا يوجد هنا مفهوم "استهلاك". */
export function InventoryFixedRow({
  index,
  tool,
  value,
  editable,
  onChange,
  error,
}: {
  index: number;
  tool: InventoryTool;
  value: FixedCheckValue;
  editable: boolean;
  onChange: (field: "found" | "notes", value: string) => void;
  error?: string | null;
}) {
  const status = computeFixedStatus(tool.total_quantity, value.found || null);

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
          type="text"
          inputMode="decimal"
          value={value.found}
          disabled={!editable}
          onChange={(e) => onChange("found", e.target.value)}
          placeholder="—"
          className={cellInput}
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <span className={`inline-block rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${INVENTORY_BADGE_CLASS[status.tone]}`}>
          {status.label}
        </span>
      </td>
      <td className="px-2.5 py-2.5">
        <input
          type="text"
          value={value.notes}
          disabled={!editable}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className={notesInput}
        />
        {error && <p className="mt-1 text-center text-[10.5px] text-[var(--inv-bad)]">{error}</p>}
      </td>
    </tr>
  );
}

/** المواد المستهلكة: رصيد بداية اليوم (مُرحَّل تلقائيًا من متبقي الأمس) +
 * المستخدم + التالف/المفقود، والمتبقي محسوب دائمًا - لا يُدخله الموظف. */
export function InventoryConsumableRow({
  index,
  tool,
  value,
  editable,
  onChange,
  error,
}: {
  index: number;
  tool: InventoryTool;
  value: ConsumableCheckValue;
  editable: boolean;
  onChange: (field: "opening" | "used" | "damaged" | "notes", value: string) => void;
  error?: string | null;
}) {
  const remaining = computeConsumableRemaining(value.opening || null, value.used || null, value.damaged || null);

  return (
    <tr className="border-b border-[var(--inv-line,#e4e0d2)] transition-colors last:border-b-0 hover:bg-black/[0.02]">
      <td className="px-2.5 py-2.5 text-center text-[12.5px] text-muted">{index + 1}</td>
      <td className="px-2.5 py-2.5 text-start">
        <div className="text-[13.5px] font-medium text-foreground">{tool.name}</div>
        {tool.unit && <span className="block text-[10.5px] text-faint">{tool.unit}</span>}
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={value.opening}
          disabled={!editable}
          onChange={(e) => onChange("opening", e.target.value)}
          placeholder="—"
          className={cellInput}
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={value.used}
          disabled={!editable}
          onChange={(e) => onChange("used", e.target.value)}
          placeholder="0"
          className={cellInput}
        />
      </td>
      <td className="px-2.5 py-2.5 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={value.damaged}
          disabled={!editable}
          onChange={(e) => onChange("damaged", e.target.value)}
          placeholder="0"
          className={cellInput}
        />
      </td>
      <td className="px-2.5 py-2.5 text-center font-display text-[13px] font-bold text-[var(--inv-emerald-900)]">
        {remaining ?? "—"}
      </td>
      <td className="px-2.5 py-2.5">
        <input
          type="text"
          value={value.notes}
          disabled={!editable}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className={notesInput}
        />
        {error && <p className="mt-1 text-center text-[10.5px] text-[var(--inv-bad)]">{error}</p>}
      </td>
    </tr>
  );
}
