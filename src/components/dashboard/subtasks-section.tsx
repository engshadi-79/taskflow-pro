"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createSubtask, deleteTask, type TaskFormState } from "@/lib/actions/tasks";
import { STATUS_LABEL, type TaskStatus } from "@/lib/types/task";

type EmployeeOption = { id: string; full_name: string };
type SubtaskRow = { id: string; title: string; status: TaskStatus; assignee: { full_name: string } | null };

const initialState: TaskFormState = {};

const STATUS_BADGE: Record<TaskStatus, string> = {
  new: "bg-border text-foreground",
  in_progress: "bg-accent-50 text-accent-700",
  pending_review: "bg-accent-100 text-accent-700",
  completed: "bg-accent-500 text-white",
  overdue: "bg-pink-50 text-pink-600",
  cancelled: "bg-border text-muted line-through",
};

export function SubtasksSection({
  parentTaskId,
  subtasks,
  employees,
  canManage,
  canDelete,
}: {
  parentTaskId: string;
  subtasks: SubtaskRow[];
  employees: EmployeeOption[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [state, formAction, pending] = useActionState(createSubtask, initialState);
  const total = subtasks.length;
  const completed = subtasks.filter((t) => t.status === "completed").length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">المهام الفرعية</h2>
        {total > 0 && (
          <span className="text-[12.5px] font-bold text-muted">
            {completed}/{total} · {rate}٪
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${rate}%` }} />
        </div>
      )}

      <ul className="space-y-1.5">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="flex items-center justify-between gap-2.5 rounded-md px-1 py-1.5 hover:bg-background"
          >
            <Link
              href={`/dashboard/tasks/${subtask.id}`}
              className={`flex-1 text-sm font-medium hover:text-accent-600 ${
                subtask.status === "completed" ? "text-faint line-through" : "text-foreground"
              }`}
            >
              {subtask.title}
            </Link>
            <span className="text-[12px] text-muted">{subtask.assignee?.full_name?.split(" ")[0]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[subtask.status]}`}>
              {STATUS_LABEL[subtask.status]}
            </span>
            {canDelete && <DeleteSubtaskButton id={subtask.id} parentTaskId={parentTaskId} />}
          </li>
        ))}
        {subtasks.length === 0 && <p className="text-sm text-muted">لا توجد مهام فرعية بعد</p>}
      </ul>

      {canManage && (
        <form action={formAction} className="flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="parent_task_id" value={parentTaskId} />
          <input
            name="title"
            placeholder="عنوان المهمة الفرعية..."
            required
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
          />
          <select
            name="assigned_to"
            required
            defaultValue=""
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            <option value="" disabled>
              اختر موظفًا
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة
          </button>
        </form>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function DeleteSubtaskButton({ id, parentTaskId }: { id: string; parentTaskId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("حذف هذه المهمة الفرعية؟")) return;
        setPending(true);
        await deleteTask(id, parentTaskId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
