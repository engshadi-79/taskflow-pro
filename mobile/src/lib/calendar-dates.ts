// Pure, timezone-safe date-key ("YYYY-MM-DD") arithmetic for the calendar
// screen. due_date in Postgres is a plain `date` - no time zone component
// at all - so "Aug 15" must always mean the same calendar day regardless of
// the viewer's local offset. `new Date("2026-08-15")` parses as UTC
// midnight, and reading it back with local getters (getDate/getMonth) can
// silently shift a day in negative-UTC time zones. Everything here works in
// UTC-anchored Date objects exclusively (Date.UTC to construct, getUTC* to
// read) so that trap never has a chance to occur. Mirrors the web app's
// src/lib/calendar-dates.ts exactly.

export type DateKey = string; // "YYYY-MM-DD"

export function todayKey(): DateKey {
  return formatDateKey(new Date());
}

export function formatDateKey(d: Date): DateKey {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateKey(d);
}

/** Sunday-first, matching this project's Arabic/RTL week convention. */
export function startOfWeek(key: DateKey): DateKey {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return formatDateKey(d);
}

export function startOfMonth(key: DateKey): DateKey {
  const d = parseDateKey(key);
  return formatDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/** The Sunday on/before the 1st, so a month grid always starts a full week. */
export function monthGridStart(key: DateKey): DateKey {
  return startOfWeek(startOfMonth(key));
}

export function isSameMonth(key: DateKey, anchor: DateKey): boolean {
  const a = parseDateKey(key);
  const b = parseDateKey(anchor);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

const MONTH_LABEL = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function dayOfMonth(key: DateKey): number {
  return parseDateKey(key).getUTCDate();
}

export function monthLabel(key: DateKey): string {
  const d = parseDateKey(key);
  return `${MONTH_LABEL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
