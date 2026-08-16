"use client";

import { buildGoogleCalendarUrl, buildIcsContent, type EventTiming } from "@/lib/calendar-export";
import { CalendarIcon, DownloadIcon } from "@/components/shared/icons";

export function AddToCalendar({
  id,
  title,
  description,
  location,
  timing,
}: {
  id: string;
  title: string;
  description?: string;
  location?: string;
  timing: EventTiming;
}) {
  const googleUrl = buildGoogleCalendarUrl({ title, description, location, ...timing });

  function downloadIcs() {
    const content = buildIcsContent({ uid: id, title, description, location, ...timing });
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-background"
      >
        <CalendarIcon className="h-4 w-4" />
        إضافة إلى Google Calendar
      </a>
      <button
        type="button"
        onClick={downloadIcs}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-background"
      >
        <DownloadIcon className="h-4 w-4" />
        تنزيل .ics (Outlook/Apple)
      </button>
    </div>
  );
}
