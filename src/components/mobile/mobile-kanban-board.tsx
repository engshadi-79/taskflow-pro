"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { moveTaskStatus } from "@/lib/actions/tasks";
import { MOBILE_PRIORITY_STYLE } from "@/lib/mobile-theme";
import { STATUS_LABEL, type TaskStatus, type TaskWithAssignee } from "@/lib/types/task";

const COLUMN_STATUSES: TaskStatus[] = ["new", "in_progress", "pending_review", "completed", "overdue"];
const COLUMN_DOT: Record<TaskStatus, string> = {
  new: "bg-brand-blue-500",
  in_progress: "bg-teal-500",
  pending_review: "bg-orange-500",
  completed: "bg-green-500",
  overdue: "bg-brand-red-500",
  cancelled: "bg-faint",
};

export function MobileKanbanBoard({
  tasks,
  canManage,
  currentUserId,
}: {
  tasks: TaskWithAssignee[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [items, setItems] = useState(tasks);
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  // Same Android WebView RTL initial-scroll-position workaround as the
  // task-list filter chips - a no-op on browsers that already start at 0.
  useEffect(() => {
    if (columnsRef.current) columnsRef.current.scrollLeft = 0;
  }, []);

  const columns = COLUMN_STATUSES.map((status) => ({
    status,
    items: items.filter((t) => t.status === status),
  }));

  const movingTask = items.find((t) => t.id === moveTaskId) ?? null;

  async function handleMove(status: TaskStatus) {
    if (!movingTask) return;
    const canMove = canManage || movingTask.assigned_to === currentUserId;
    if (!canMove) {
      setError("غير مصرح لك بتحديث هذه المهمة");
      setMoveTaskId(null);
      return;
    }
    const previous = items;
    setItems((prev) => prev.map((t) => (t.id === movingTask.id ? { ...t, status } : t)));
    setMoveTaskId(null);
    const result = await moveTaskStatus(movingTask.id, status);
    if (result?.error) {
      setItems(previous);
      setError(result.error);
    }
  }

  return (
    <div>
      <div ref={columnsRef} className="flex gap-3 overflow-x-auto px-4 pb-6">
        {columns.map((col) => (
          <div key={col.status} className="w-[210px] shrink-0 rounded-[14px] bg-background p-2.5">
            <div className="mb-2.5 flex items-center gap-1.5 px-1">
              <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[col.status]}`} />
              <span className="text-[12.5px] font-extrabold text-foreground">{STATUS_LABEL[col.status]}</span>
              <span className="ms-auto text-[11px] font-bold text-muted">{col.items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {col.items.map((task) => (
                <div key={task.id} className="rounded-[12px] bg-surface p-2.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                  <Link href={`/m/tasks/${task.id}`} className="text-[12.5px] font-bold text-foreground">
                    {task.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${MOBILE_PRIORITY_STYLE[task.priority].dot}`} />
                    <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-muted">{task.assignee?.full_name ?? "—"}</span>
                    <button
                      type="button"
                      onClick={() => setMoveTaskId(task.id)}
                      className="shrink-0 rounded-full bg-accent-50 px-2 py-1 text-[9.5px] font-extrabold text-accent-600"
                    >
                      نقل
                    </button>
                  </div>
                </div>
              ))}
              {col.items.length === 0 && <p className="py-3 text-center text-[11px] text-faint">لا توجد مهام</p>}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-[448px] rounded-[10px] bg-brand-red-50 p-2.5 text-center text-[12px] font-bold text-brand-red-600">
          {error}
        </div>
      )}

      {movingTask && (
        <div onClick={() => setMoveTaskId(null)} className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-t-[20px] bg-surface p-4.5 pb-6">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" />
            <div className="mb-3 text-[14px] font-extrabold text-foreground">نقل المهمة إلى</div>
            {COLUMN_STATUSES.filter((s) => s !== movingTask.status).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleMove(status)}
                className="flex w-full items-center gap-2.5 border-b border-border py-3 last:border-b-0"
              >
                <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[status]}`} />
                <span className="text-[13px] font-bold text-foreground">{STATUS_LABEL[status]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
