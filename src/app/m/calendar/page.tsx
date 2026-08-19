import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  addDays,
  dayOfMonth,
  formatDateKey,
  isSameMonth,
  monthGridStart,
  monthLabel,
  parseDateKey,
  todayKey,
  type DateKey,
} from "@/lib/calendar-dates";

const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function shiftMonth(anchor: DateKey, direction: 1 | -1): DateKey {
  const d = parseDateKey(anchor);
  return formatDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1)));
}

export default async function MobileCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const anchor: DateKey = params.month && /^\d{4}-\d{2}-\d{2}$/.test(params.month) ? params.month : todayKey();
  const rangeStart = monthGridStart(anchor);
  const rangeEnd = addDays(rangeStart, 41);
  const todayIso = todayKey();
  const selectedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;

  const supabase = await createClient();
  let taskQuery = supabase
    .from("tasks")
    .select("id, due_date")
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .not("due_date", "is", null);
  if (profile.role === "employee") taskQuery = taskQuery.eq("assigned_to", profile.id);

  const [{ data: tasks }, { data: milestones }, { data: meetings }] = await Promise.all([
    taskQuery.returns<{ id: string; due_date: string }[]>(),
    supabase
      .from("project_milestones")
      .select("id, due_date")
      .gte("due_date", rangeStart)
      .lte("due_date", rangeEnd)
      .not("due_date", "is", null)
      .returns<{ id: string; due_date: string }[]>(),
    supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time")
      .gte("meeting_date", rangeStart)
      .lte("meeting_date", rangeEnd)
      .neq("status", "cancelled")
      .returns<{ id: string; title: string; meeting_date: string; meeting_time: string | null }[]>(),
  ]);

  const eventDays = new Set<string>();
  for (const t of tasks ?? []) eventDays.add(t.due_date);
  for (const m of milestones ?? []) eventDays.add(m.due_date);
  for (const mt of meetings ?? []) eventDays.add(mt.meeting_date);

  const days: DateKey[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    days.push(d);
    if (d === rangeEnd) break;
  }

  const selectedDayTaskCount = selectedDay ? (tasks ?? []).filter((t) => t.due_date === selectedDay).length : 0;
  const selectedDayMilestoneCount = selectedDay ? (milestones ?? []).filter((m) => m.due_date === selectedDay).length : 0;
  const selectedDayMeetings = selectedDay ? (meetings ?? []).filter((m) => m.meeting_date === selectedDay) : [];
  const hasSelectedEvents = selectedDayTaskCount > 0 || selectedDayMilestoneCount > 0 || selectedDayMeetings.length > 0;

  return (
    <div>
      <MobileHeader
        title="التقويم"
        subtitle={monthLabel(anchor)}
        action={
          <div className="flex gap-1.5">
            <Link href={`/m/calendar?month=${shiftMonth(anchor, -1)}`} className="rounded-full bg-background px-2.5 py-1.5 text-[12px] font-bold text-foreground">
              ‹
            </Link>
            <Link href={`/m/calendar?month=${todayKey()}`} className="rounded-full bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground">
              اليوم
            </Link>
            <Link href={`/m/calendar?month=${shiftMonth(anchor, 1)}`} className="rounded-full bg-background px-2.5 py-1.5 text-[12px] font-bold text-foreground">
              ›
            </Link>
          </div>
        }
      />

      <div className="px-4 pb-6">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-faint">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = isSameMonth(d, anchor);
            const isToday = d === todayIso;
            const isSelected = d === selectedDay;
            const hasEvent = eventDays.has(d);
            return (
              <Link
                key={d}
                href={`/m/calendar?month=${anchor}&day=${d}`}
                className={`flex flex-col items-center gap-0.5 rounded-[10px] py-1.5 ${
                  isSelected ? "bg-accent-600 text-white" : isToday ? "bg-accent-50 text-accent-700" : inMonth ? "text-foreground" : "text-faint/50"
                }`}
              >
                <span className="text-[12px] font-bold">{dayOfMonth(d)}</span>
                {hasEvent && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-accent-500"}`} />}
              </Link>
            );
          })}
        </div>

        {selectedDay && (
          <div className="mt-5">
            <h3 className="mb-2.5 text-[13px] font-extrabold text-foreground">{selectedDay}</h3>
            <div className="flex flex-col gap-2">
              {selectedDayTaskCount > 0 && (
                <Link href="/m/tasks" className="rounded-[12px] bg-surface p-3 text-[12.5px] font-bold text-foreground shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                  {selectedDayTaskCount} مهمة مستحقة
                </Link>
              )}
              {selectedDayMilestoneCount > 0 && (
                <div className="rounded-[12px] bg-surface p-3 text-[12.5px] font-bold text-foreground shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                  {selectedDayMilestoneCount} مرحلة مشروع
                </div>
              )}
              {selectedDayMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/m/meetings/${m.id}`}
                  className="rounded-[12px] bg-surface p-3 text-[12.5px] font-bold text-foreground shadow-[0_4px_12px_rgba(30,41,59,.06)]"
                >
                  {m.title}
                  {m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : ""}
                </Link>
              ))}
              {!hasSelectedEvents && <p className="text-[12.5px] text-muted">لا توجد أحداث في هذا اليوم</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
