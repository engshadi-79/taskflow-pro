export type InventoryStatusTone = "ok" | "warn" | "bad" | "idle";

export type InventoryStatus = { label: string; tone: InventoryStatusTone };

function parseNum(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/** Fixed tools: compare "الموجود فعليًا" against the tool's reference
 * total_quantity. Both are free text (real quantities mix numbers with
 * unit/status words), so a numeric verdict only applies when both sides
 * actually parse as numbers. */
export function computeFixedStatus(totalQuantity: string | null, foundQuantity: string | null): InventoryStatus {
  if (!foundQuantity) return { label: "لم يُجرد", tone: "idle" };

  const total = parseNum(totalQuantity);
  const found = parseNum(foundQuantity);
  if (total !== null && found !== null) {
    if (found === total) return { label: "جيد", tone: "ok" };
    if (found < total) return { label: `نقص ${total - found}`, tone: "bad" };
    return { label: "زيادة", tone: "warn" };
  }
  return { label: "مُسجَّل", tone: "ok" };
}

/** Consumables: المتبقي = رصيد بداية اليوم − المستخدم − التالف/المفقود.
 * Returns null (rendered as "—") when any of the three isn't a real
 * number - the same free-text-quantity tolerance as everywhere else in
 * this feature. */
export function computeConsumableRemaining(
  opening: string | null,
  used: string | null,
  damagedLost: string | null
): number | null {
  const openingNum = parseNum(opening);
  if (openingNum === null) return null;
  const usedNum = parseNum(used) ?? 0;
  const damagedNum = parseNum(damagedLost) ?? 0;
  return openingNum - usedNum - damagedNum;
}

export const INVENTORY_BADGE_CLASS: Record<InventoryStatusTone, string> = {
  ok: "bg-[var(--inv-ok-bg)] text-[var(--inv-ok)]",
  warn: "bg-[var(--inv-warn-bg)] text-[var(--inv-warn)]",
  bad: "bg-[var(--inv-bad-bg)] text-[var(--inv-bad)]",
  idle: "bg-[var(--inv-idle-bg)] text-[var(--inv-idle)]",
};

/** The reference design's emerald/gold "official certificate" palette,
 * applied as CSS custom properties on a wrapper div so the rest of the
 * app's own indigo/accent theme is completely untouched - this feature is
 * deliberately styled apart from the standard dashboard chrome. */
export const INVENTORY_THEME_VARS: React.CSSProperties = {
  ["--inv-emerald-950" as string]: "#0a2e24",
  ["--inv-emerald-900" as string]: "#0d3c2e",
  ["--inv-emerald-800" as string]: "#124a38",
  ["--inv-emerald-700" as string]: "#186349",
  ["--inv-gold" as string]: "#c8a027",
  ["--inv-gold-light" as string]: "#e4c766",
  ["--inv-ok" as string]: "#2f8f5b",
  ["--inv-ok-bg" as string]: "#e7f4ec",
  ["--inv-warn" as string]: "#c8862a",
  ["--inv-warn-bg" as string]: "#faf0dd",
  ["--inv-bad" as string]: "#b8402a",
  ["--inv-bad-bg" as string]: "#faeae5",
  ["--inv-idle" as string]: "#9aa39c",
  ["--inv-idle-bg" as string]: "#eef0ea",
};
