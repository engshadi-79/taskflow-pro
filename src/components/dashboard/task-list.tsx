"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteTask } from "@/lib/actions/tasks";
import { CheckIcon, SearchIcon } from "@/components/shared/icons";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskStatus,
  type TaskWithAssignee,
} from "@/lib/types/task";

const STATUS_BADGE: Record<TaskStatus, string> = {
  new: "bg-border text-foreground",
  in_progress: "bg-accent-50 text-accent-700",
  pending_review: "bg-accent-100 text-accent-700",
  completed: "bg-accent-500 text-white",
  overdue: "bg-pink-50 text-pink-600",
  cancelled: "bg-border text-muted line-through",
};

const FILTERS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "new", label: "جديدة" },
  { key: "in_progress", label: "جارية" },
  { key: "pending_review", label: "بانتظار المراجعة" },
  { key: "completed", label: "منجزة" },
  { key: "overdue", label: "متأخرة" },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
}

export function TaskList({
  tasks,
  canDelete,
}: {
  tasks: TaskWithAssignee[];
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: tasks.length };
    for (const t of tasks) map[t.status] = (map[t.status] ?? 0) + 1;
    return map;
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (search.trim() && !t.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [tasks, filter, search]);

  return (
    <div className="space-y-4.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4.5 py-2 text-[13px] font-bold ${
              filter === f.key
                ? "border-foreground bg-foreground text-surface"
                : "border-border bg-surface text-muted"
            }`}
          >
            {f.label} {counts[f.key] ? `(${counts[f.key]})` : counts[f.key] === 0 ? "(0)" : ""}
          </button>
        ))}
        <div className="flex-1" />
        <label className="relative">
          <span className="sr-only">ابحث عن مهمة</span>
          <SearchIcon className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن مهمة..."
            className="w-55 rounded-full border border-border bg-surface py-2 pe-10 ps-4.5 text-[13px] text-foreground placeholder:text-faint focus:border-accent-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-1.5 py-4 text-start"></th>
              <th className="px-1.5 py-4 text-start">المهمة</th>
              <th className="px-1.5 py-4 text-start">المسؤول</th>
              <th className="px-1.5 py-4 text-start">الأولوية</th>
              <th className="px-1.5 py-4 text-start">الحالة</th>
              <th className="px-1.5 py-4 text-start">الموعد</th>
              <th className="px-1.5 py-4 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr key={task.id} className="border-t border-border">
                <td className="px-1.5 py-4">
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 ${
                      task.status === "completed"
                        ? "border-green-500 bg-green-500 text-[10px] text-white"
                        : "border-border"
                    }`}
                  >
                    {task.status === "completed" && (
                      <CheckIcon className="h-3 w-3 stroke-[3]" />
                    )}
                  </span>
                </td>
                <td className="px-1.5 py-4">
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className={`font-medium hover:text-accent-600 ${
                      task.status === "completed" ? "text-faint line-through" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </Link>
                </td>
                <td className="px-1.5 py-4">
                  {task.assignee && (
                    <div className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-500 text-[10.5px] text-white">
                        {initials(task.assignee.full_name)}
                      </span>
                      {task.assignee.full_name.split(" ")[0]}
                    </div>
                  )}
                </td>
                <td
                  className={`px-1.5 py-4 ${
                    task.priority === "urgent" ? "font-semibold text-pink-600" : "text-muted"
                  }`}
                >
                  {PRIORITY_LABEL[task.priority]}
                </td>
                <td className="px-1.5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[task.status]}`}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                </td>
                <td className="px-1.5 py-4 text-muted">{task.due_date ?? "—"}</td>
                <td className="px-1.5 py-4">
                  <div className="flex gap-3">
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className="text-sm text-accent-600 hover:underline"
                    >
                      تعديل
                    </Link>
                    {canDelete && <DeleteButton id={task.id} />}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  لا توجد مهام مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
        setPending(true);
        const result = await deleteTask(id);
        setPending(false);
        if (result?.error) {
          alert(result.error);
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
