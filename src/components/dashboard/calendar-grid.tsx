"use client";

import Link from "next/link";
import { useState } from "react";
import { rescheduleTask } from "@/lib/actions/tasks";
import { dayOfMonth, isSameMonth, todayKey, weekdayLabel, type DateKey } from "@/lib/calendar-dates";
import { RefreshIcon } from "@/components/shared/icons";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/types/task";

export type CalendarTaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string;
  is_recurring: boolean;
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
  canManage,
  currentUserId,
}: {
  cells: CalendarCell[];
  view: "month" | "week" | "day";
  /** Any date within the month being shown - only used to grey out
   * days that spill into the next/previous month in month view. */
  anchorMonth: DateKey;
  /** Same permission shape as rescheduleTask: managers can drag anyone's
   * task, an assignee can only drag their own - gating `draggable` here
   * too (not just the server check) matches KanbanBoard's existing UX
   * instead of letting a disallowed drag fail after the fact. */
  canManage: boolean;
  currentUserId: string;
}) {
  const [byDate, setByDate] = useState<Record<DateKey, CalendarTaskItem[]>>(() => {
    const map: Record<DateKey, CalendarTaskItem[]> = {};
    for (const cell of cells) map[cell.date] = cell.tasks;
    return map;
  });
  const [dragOverDate, setDragOverDate] = useState<DateKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Below md the grid cells are too narrow for the inline task chips to be
  // readable or reliably tappable (that's what made tapping a day feel like
  // it did nothing) - tapping a day there just selects it, and its full
  // items list renders as a readable panel under the grid instead.
  const [selectedDate, setSelectedDate] = useState<DateKey | null>(null);
  const today = todayKey();
  const selectedCell = cells.find((c) => c.date === selectedDate) ?? null;

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
          const hasItems =
            tasks.length > 0 || cell.milestones.length > 0 || cell.projectDeadlines.length > 0 || cell.meetings.length > 0;
          const dots = [
            ...cell.projectDeadlines.map(() => "bg-purple-500"),
            ...cell.milestones.map(() => "bg-teal-500"),
            ...cell.meetings.map(() => "bg-orange-500"),
            ...tasks.map((t) => PRIORITY_DOT[t.priority]),
          ];

          const dayHeader = (
            <div
              className={`mb-1.5 flex items-center justify-between text-[12px] font-bold ${
                isToday ? "text-accent-600" : "text-muted"
              }`}
            >
              <span>{view === "day" ? `${weekdayLabel(cell.date)} ${dayOfMonth(cell.date)}` : dayOfMonth(cell.date)}</span>
              {isToday && <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] text-accent-600">اليوم</span>}
            </div>
          );

          const itemsList = (
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
              {tasks.map((task) => {
                const canDrag = canManage || task.assigned_to === currentUserId;
                return (
                  <div
                    key={task.id}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag) return;
                      e.dataTransfer.setData("text/plain", task.id);
                    }}
                    title={`${PRIORITY_LABEL[task.priority]} — ${STATUS_LABEL[task.status]}`}
                    className={`flex items-center gap-1.5 truncate rounded bg-background px-1.5 py-1 text-[11px] ${
                      canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-90"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                    {task.is_recurring && <RefreshIcon className="h-3 w-3 shrink-0 text-accent-500" />}
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className={`truncate hover:text-accent-600 ${
                        task.status === "completed"
                          ? "text-faint line-through"
                          : task.status === "overdue"
                            ? "font-bold text-brand-red-500"
                            : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </Link>
                  </div>
                );
              })}
            </div>
          );

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
              className={`rounded-[12px] border p-2 transition-colors ${
                view === "day" ? "min-h-28" : "min-h-[52px] md:min-h-28"
              } ${dragOverDate === cell.date ? "border-accent-500 ring-2 ring-accent-500/30" : "border-border"} ${
                dimmed ? "bg-background/50 opacity-50" : "bg-surface"
              } ${selectedDate === cell.date ? "ring-2 ring-accent-500" : ""}`}
            >
              {view === "day" ? (
                <>
                  {dayHeader}
                  {itemsList}
                </>
              ) : (
                <>
                  <div className="hidden md:block">
                    {dayHeader}
                    {itemsList}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => (d === cell.date ? null : cell.date))}
                    className="flex w-full flex-col items-center gap-1 md:hidden"
                  >
                    <span className={`text-[12.5px] font-bold ${isToday ? "text-accent-600" : "text-muted"}`}>
                      {dayOfMonth(cell.date)}
                    </span>
                    {hasItems && (
                      <span className="flex flex-wrap justify-center gap-0.5">
                        {dots.slice(0, 4).map((dot, i) => (
                          <span key={i} className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        ))}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {view !== "day" && selectedCell && (
        <div className="rounded-[14px] border border-border bg-surface p-3.5 md:hidden">
          <h3 className="mb-2.5 text-[13px] font-extrabold text-foreground">{selectedCell.date}</h3>
          {selectedCell.tasks.length === 0 &&
          selectedCell.milestones.length === 0 &&
          selectedCell.projectDeadlines.length === 0 &&
          selectedCell.meetings.length === 0 ? (
            <p className="text-[12.5px] text-muted">لا توجد أحداث في هذا اليوم</p>
          ) : (
            <div className="space-y-2">
              {selectedCell.projectDeadlines.map((p) => (
                <div key={`p-${p.id}`} className="rounded-[10px] bg-purple-50 px-3 py-2.5 text-[12.5px] font-bold text-purple-600">
                  نهاية مشروع: {p.name}
                </div>
              ))}
              {selectedCell.milestones.map((m) => (
                <div key={`m-${m.id}`} className="rounded-[10px] bg-teal-50 px-3 py-2.5 text-[12.5px] font-bold text-teal-600">
                  مرحلة: {m.title}
                </div>
              ))}
              {selectedCell.meetings.map((mt) => (
                <Link
                  key={`mt-${mt.id}`}
                  href={`/dashboard/meetings/${mt.id}`}
                  className="block rounded-[10px] bg-orange-50 px-3 py-2.5 text-[12.5px] font-bold text-orange-600"
                >
                  اجتماع{mt.meeting_time ? ` ${mt.meeting_time}` : ""}: {mt.title}
                </Link>
              ))}
              {(byDate[selectedCell.date] ?? []).map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="flex items-center gap-2 rounded-[10px] bg-background px-3 py-2.5 text-[12.5px]"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                  {task.is_recurring && <RefreshIcon className="h-3.5 w-3.5 shrink-0 text-accent-500" />}
                  <span
                    className={`truncate ${
                      task.status === "completed"
                        ? "text-faint line-through"
                        : task.status === "overdue"
                          ? "font-bold text-brand-red-500"
                          : "font-bold text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
