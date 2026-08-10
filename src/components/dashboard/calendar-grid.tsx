"use client";

import Link from "next/link";
import { useState } from "react";
import { rescheduleTask } from "@/lib/actions/tasks";
import { dayOfMonth, isSameMonth, todayKey, weekdayLabel, type DateKey } from "@/lib/calendar-dates";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/types/task";

export type CalendarTaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee_name: string | null;
};

export type CalendarMilestoneItem = { id: string; title: string; project_name: string };
export type CalendarProjectItem = { id: string; name: string };
export type CalendarMeetingItem = { id: string; title: string; meeting_time: string | null };

export type CalendarCell = {
  date: DateKey;
  tasks: CalendarTaskItem[];
  milestones: CalendarMilestoneItem[];
  projectDeadlines: CalendarProjectItem[];
  meetings: CalendarMeetingItem[];
};

const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-border",
  medium: "bg-brand-blue-500",
  high: "bg-orange-500",
  urgent: "bg-brand-red-500",
};

export function CalendarGrid({
  cells,
  view,
  anchorMonth,
}: {
  cells: CalendarCell[];
  view: "month" | "week" | "day";
  /** Any date within the month being shown - only used to grey out
   * days that spill into the next/previous month in month view. */
  anchorMonth: DateKey;
}) {
  const [byDate, setByDate] = useState<Record<DateKey, CalendarTaskItem[]>>(() => {
    const map: Record<DateKey, CalendarTaskItem[]> = {};
    for (const cell of cells) map[cell.date] = cell.tasks;
    return map;
  });
  const [dragOverDate, setDragOverDate] = useState<DateKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();

  async function handleDrop(targetDate: DateKey, taskId: string) {
    setDragOverDate(null);
    let sourceDate: DateKey | null = null;
    for (const [date, tasks] of Object.entries(byDate)) {
      if (tasks.some((t) => t.id === taskId)) {
        sourceDate = date;
        break;
      }
    }
    if (!sourceDate || sourceDate === targetDate) return;

    const previous = byDate;
    const moving = byDate[sourceDate].find((t) => t.id === taskId)!;
    setByDate((prev) => ({
      ...prev,
      [sourceDate!]: prev[sourceDate!].filter((t) => t.id !== taskId),
      [targetDate]: [...(prev[targetDate] ?? []), moving],
    }));

    const result = await rescheduleTask(taskId, targetDate);
    if (result?.error) {
      setByDate(previous);
      setError(result.error);
    } else {
      setError(null);
    }
  }

  const gridCols = view === "day" ? "grid-cols-1" : "grid-cols-7";

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md bg-pink-50 px-4 py-2 text-sm font-medium text-pink-600">{error}</p>
      )}

      {view !== "day" && (
        <div className={`grid ${gridCols} gap-2 text-center text-[12px] font-bold text-muted`}>
          {cells.slice(0, 7).map((cell) => (
            <div key={cell.date}>{weekdayLabel(cell.date)}</div>
          ))}
        </div>
      )}

      <div className={`grid ${gridCols} gap-2`}>
        {cells.map((cell) => {
          const tasks = byDate[cell.date] ?? [];
          const dimmed = view === "month" && !isSameMonth(cell.date, anchorMonth);
          const isToday = cell.date === today;

          return (
            <div
              key={cell.date}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDate(cell.date);
              }}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) handleDrop(cell.date, taskId);
              }}
              className={`min-h-28 rounded-[12px] border p-2 transition-colors ${
                dragOverDate === cell.date
                  ? "border-accent-500 ring-2 ring-accent-500/30"
                  : "border-border"
              } ${dimmed ? "bg-background/50 opacity-50" : "bg-surface"}`}
            >
              <div
                className={`mb-1.5 flex items-center justify-between text-[12px] font-bold ${
                  isToday ? "text-accent-600" : "text-muted"
                }`}
              >
                <span>{view === "day" ? `${weekdayLabel(cell.date)} ${dayOfMonth(cell.date)}` : dayOfMonth(cell.date)}</span>
                {isToday && <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] text-accent-600">اليوم</span>}
              </div>

              <div className="space-y-1">
                {cell.projectDeadlines.map((p) => (
                  <div key={`p-${p.id}`} className="truncate rounded bg-purple-50 px-1.5 py-1 text-[11px] font-bold text-purple-600">
                    نهاية مشروع: {p.name}
                  </div>
                ))}
                {cell.milestones.map((m) => (
                  <div key={`m-${m.id}`} className="truncate rounded bg-teal-50 px-1.5 py-1 text-[11px] font-bold text-teal-600">
                    مرحلة: {m.title}
                  </div>
                ))}
                {cell.meetings.map((mt) => (
                  <Link
                    key={`mt-${mt.id}`}
                    href={`/dashboard/meetings/${mt.id}`}
                    className="block truncate rounded bg-orange-50 px-1.5 py-1 text-[11px] font-bold text-orange-600 hover:underline"
                  >
                    اجتماع{mt.meeting_time ? ` ${mt.meeting_time}` : ""}: {mt.title}
                  </Link>
                ))}
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                    title={`${PRIORITY_LABEL[task.priority]} — ${STATUS_LABEL[task.status]}`}
                    className="flex cursor-grab items-center gap-1.5 truncate rounded bg-background px-1.5 py-1 text-[11px] active:cursor-grabbing"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className={`truncate hover:text-accent-600 ${
                        task.status === "completed" ? "text-faint line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
