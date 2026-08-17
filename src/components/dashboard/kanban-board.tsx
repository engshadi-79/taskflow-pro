"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { moveTaskStatus, archiveTask } from "@/lib/actions/tasks";
import { CalendarIcon, InboxIcon } from "@/components/shared/icons";
import { Avatar } from "@/components/shared/avatar";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskStatus,
  type TaskWithAssignee,
} from "@/lib/types/task";

/** `dot` tints the status chip, `edge` the leading rule on each task card. */
const COLUMNS: { status: TaskStatus; dot: string; edge: string }[] = [
  { status: "new", dot: "bg-brand-blue-50 text-brand-blue-600", edge: "border-s-brand-blue-500" },
  { status: "in_progress", dot: "bg-teal-50 text-teal-500", edge: "border-s-teal-500" },
  { status: "pending_review", dot: "bg-orange-50 text-orange-600", edge: "border-s-orange-500" },
  { status: "completed", dot: "bg-green-50 text-green-500", edge: "border-s-green-500" },
  { status: "overdue", dot: "bg-brand-red-50 text-brand-red-500", edge: "border-s-brand-red-500" },
];

const PRIORITY_TAG: Record<string, string> = {
  low: "bg-background text-muted",
  medium: "bg-brand-blue-50 text-brand-blue-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-brand-red-50 text-brand-red-500",
};

export function KanbanBoard({
  tasks,
  canManage,
  currentUserId,
}: {
  tasks: TaskWithAssignee[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [items, setItems] = useState(tasks);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // same auth-race fix as notification-bell.tsx: await the session before
    // subscribing, or RLS silently drops every event on a freshly-loaded tab
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("kanban-tasks")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tasks" },
          (payload) => {
            const updated = payload.new as { id: string; status: TaskStatus };
            setItems((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t))
            );
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function handleDrop(status: TaskStatus, taskId: string) {
    setDragOverStatus(null);
    const task = items.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    const canDrag = canManage || task.assigned_to === currentUserId;
    if (!canDrag) {
      setError("غير مصرح لك بتحديث هذه المهمة");
      return;
    }

    const previous = items;
    setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    const result = await moveTaskStatus(taskId, status);
    if (result?.error) {
      setItems(previous);
      setError(result.error);
    }
  }

  async function handleArchive(taskId: string) {
    if (!confirm("أرشفة هذه المهمة؟ ستختفي من لوحة كانبان.")) return;
    const previous = items;
    setItems((prev) => prev.filter((t) => t.id !== taskId));
    const result = await archiveTask(taskId);
    if (result?.error) {
      setItems(previous);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-pink-50 px-4 py-2 text-sm font-medium text-pink-600">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 items-start gap-4.5 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const colTasks = items.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                handleDrop(col.status, taskId);
              }}
              className={`rounded-2xl border border-border bg-background p-3 transition-colors ${
                dragOverStatus === col.status
                  ? "border-accent-500 ring-2 ring-accent-500/30"
                  : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between rounded-[13px] border border-border bg-surface px-3 py-2.5">
                <h4 className="flex items-center gap-2 text-[13.5px] font-extrabold text-foreground">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-lg ${col.dot}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                  </span>
                  {STATUS_LABEL[col.status]}
                </h4>
                <span className="rounded-full bg-background px-2.5 py-0.5 text-[11.5px] font-extrabold text-muted">
                  {colTasks.length}
                </span>
              </div>

              {colTasks.map((task) => {
                const canDrag = canManage || task.assigned_to === currentUserId;
                return (
                  <div
                    key={task.id}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                    }}
                    className={`mb-2.5 rounded-[13px] border border-border border-s-[3px] bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md ${col.edge} ${
                      canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-90"
                    }`}
                  >
                    <span
                      className={`mb-2.5 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold ${PRIORITY_TAG[task.priority]}`}
                    >
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className="mb-2 block text-sm font-extrabold leading-6 text-foreground hover:text-accent-600"
                    >
                      {task.title}
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-y-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11.5px] ${
                          col.status === "overdue"
                            ? "font-bold text-brand-red-500"
                            : "text-faint"
                        }`}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {task.due_date ?? "—"}
                      </span>
                      {task.assignee && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11.5px] font-bold text-muted">
                            {task.assignee.full_name}
                          </span>
                          <Avatar
                            src={task.assignee.avatar_url}
                            name={task.assignee.full_name}
                            size={24}
                            className="text-[10px]"
                            decorative
                          />
                        </span>
                      )}
                    </div>
                    {col.status === "completed" && canManage && (
                      <button
                        type="button"
                        onClick={() => handleArchive(task.id)}
                        className="mt-3 w-full rounded-[8px] border border-border py-1.5 text-[11px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600"
                      >
                        أرشفة
                      </button>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-7 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-faint">
                    <InboxIcon className="h-5 w-5" />
                  </span>
                  <p className="text-xs text-faint">لا توجد مهام</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
