import type { InventoryDailyCheck } from "@/lib/types/inventory";

export type InventoryStatusTone = "ok" | "warn" | "bad" | "idle";

export type InventoryStatus = { label: string; tone: InventoryStatusTone };

/** Compares a tool's counted "الكمية الفعلية" against its total_quantity
 * for the day. Both are free text (real data mixes numbers with unit/status
 * words like "لتر" or "مفقودة"), so a numeric comparison only applies when
 * both sides actually parse as numbers - otherwise "recorded" is as
 * specific as it's honest to be. */
export function computeInventoryStatus(
  totalQuantity: string | null,
  check: Pick<InventoryDailyCheck, "morning_checked" | "evening_checked" | "actual_quantity"> | null
): InventoryStatus {
  const hasAnyEntry = !!check && (check.morning_checked || check.evening_checked || !!check.actual_quantity);
  if (!hasAnyEntry) {
    return { label: "لم يُجرد", tone: "idle" };
  }

  if (!check?.actual_quantity) {
    return { label: "بانتظار العدد", tone: "warn" };
  }

  const totalNum = totalQuantity !== null ? parseFloat(totalQuantity) : NaN;
  const actualNum = parseFloat(check.actual_quantity);

  if (!isNaN(totalNum) && !isNaN(actualNum)) {
    if (actualNum === totalNum) return { label: "مطابق", tone: "ok" };
    if (actualNum < totalNum) return { label: `نقص ${totalNum - actualNum}`, tone: "bad" };
    return { label: "زيادة", tone: "warn" };
  }

  return { label: "مُسجَّل", tone: "ok" };
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
