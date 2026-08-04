"use client";

import Link from "next/link";
import { useState } from "react";
import { moveTaskStatus } from "@/lib/actions/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskStatus,
  type TaskWithAssignee,
} from "@/lib/types/task";

const COLUMNS: { status: TaskStatus; dot: string }[] = [
  { status: "new", dot: "bg-orange-500" },
  { status: "in_progress", dot: "bg-accent-500" },
  { status: "pending_review", dot: "bg-purple-500" },
  { status: "completed", dot: "bg-green-500" },
  { status: "overdue", dot: "bg-pink-500" },
];

const PRIORITY_TAG: Record<string, string> = {
  low: "bg-accent-50 text-accent-500",
  medium: "bg-orange-50 text-orange-600",
  high: "bg-pink-50 text-pink-600",
  urgent: "bg-pink-50 text-pink-600",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
}

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
              className={`rounded-2xl bg-sidebar p-4 transition-colors ${
                dragOverStatus === col.status ? "ring-2 ring-accent-500" : ""
              }`}
            >
              <div className="mb-3.5 flex items-center justify-between px-1">
                <h4 className="flex items-center gap-2 text-[13.5px] font-extrabold text-foreground">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {STATUS_LABEL[col.status]}
                </h4>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11.5px] font-extrabold text-faint">
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
                    className={`mb-3 rounded-[14px] border border-border bg-surface p-4 shadow-[0_8px_18px_-14px_rgba(29,31,43,0.25)] ${
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
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`text-[11.5px] ${
                          col.status === "overdue" ? "font-bold text-pink-600" : "text-faint"
                        }`}
                      >
                        📅 {task.due_date ?? "—"}
                      </span>
                      {task.assignee && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-[10px] font-extrabold text-white">
                          {initials(task.assignee.full_name)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-faint">لا توجد مهام</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
