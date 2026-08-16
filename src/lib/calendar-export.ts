/**
 * "Add to calendar" for meetings/tasks with zero OAuth scopes - a plain
 * Google Calendar prefilled-event link plus a downloadable .ics file
 * (Outlook/Apple/any calendar app) needs no API access or Google Cloud
 * Console configuration at all, unlike two-way sync (see PROJECT(3).md's
 * P19 section for why that's deferred). Date/time values are treated as
 * the viewer's local wall-clock time - correct for the common case of an
 * organization's own members viewing their own organization's meetings,
 * without needing real timezone-conversion machinery.
 */

export type EventTiming = { allDay: true; date: Date } | { allDay?: false; start: Date; end: Date };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatDateTimeUtc(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function escapeIcsText(text: string): string {
  return text.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

type EventInput = { title: string; description?: string; location?: string } & EventTiming;

export function buildGoogleCalendarUrl(opts: EventInput): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: opts.title });
  if (opts.allDay) {
    params.set("dates", `${formatDateOnly(opts.date)}/${formatDateOnly(addDays(opts.date, 1))}`);
  } else {
    params.set("dates", `${formatDateTimeUtc(opts.start)}/${formatDateTimeUtc(opts.end)}`);
  }
  if (opts.description) params.set("details", opts.description);
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(opts: { uid: string } & EventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MONJEZ//ar",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@monjez`,
    `DTSTAMP:${formatDateTimeUtc(new Date())}`,
  ];
  if (opts.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(opts.date)}`, `DTEND;VALUE=DATE:${formatDateOnly(addDays(opts.date, 1))}`);
  } else {
    lines.push(`DTSTART:${formatDateTimeUtc(opts.start)}`, `DTEND:${formatDateTimeUtc(opts.end)}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(opts.title)}`);
  if (opts.description) lines.push(`DESCRIPTION:${escapeIcsText(opts.description)}`);
  if (opts.location) lines.push(`LOCATION:${escapeIcsText(opts.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
