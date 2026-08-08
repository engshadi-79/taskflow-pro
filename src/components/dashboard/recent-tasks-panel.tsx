"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/shared/icons";
import { Avatar } from "@/components/shared/avatar";
import { PRIORITY_LABEL, STATUS_LABEL, type TaskWithAssignee } from "@/lib/types/task";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-border text-foreground",
  in_progress: "bg-accent-50 text-accent-700",
  pending_review: "bg-orange-50 text-orange-600",
  completed: "bg-green-50 text-green-600",
  overdue: "bg-brand-red-50 text-brand-red-500",
  cancelled: "bg-border text-muted line-through",
};

export function RecentTasksPanel({ tasks }: { tasks: TaskWithAssignee[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.assignee?.full_name ?? "").toLowerCase().includes(q)
    );
  }, [tasks, query]);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-[22px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-[14.5px] font-extrabold text-foreground">سجل المهام الحديثة</h4>
          <small className="mt-0.5 block text-[11.5px] font-medium text-faint">
            أحدث المهام في مؤسستك
          </small>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative">
            <span className="sr-only">بحث في المهام</span>
            <SearchIcon className="pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في المهام..."
              className="w-40 rounded-full border border-border bg-background py-1.5 pe-8 ps-3 text-[12.5px] text-foreground outline-none placeholder:text-faint focus:border-accent-500"
            />
          </label>
          <Link
            href="/dashboard/tasks"
            className="shrink-0 text-[12.5px] font-bold text-accent-600 hover:underline"
          >
            عرض الكل
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-[11px] text-faint">
            <tr>
              <th className="px-1.5 pb-2.5 text-start">المهمة / المسؤول</th>
              <th className="px-1.5 pb-2.5 text-start">الأولوية</th>
              <th className="px-1.5 pb-2.5 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 8).map((task) => (
              <tr key={task.id} className="border-t border-border">
                <td className="px-1.5 py-3">
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="block font-bold text-foreground hover:text-accent-600"
                  >
                    {task.title}
                  </Link>
                  {task.assignee && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                      <Avatar
                        src={task.assignee.avatar_url}
                        name={task.assignee.full_name}
                        size={18}
                        decorative
                      />
                      {task.assignee.full_name}
                    </div>
                  )}
                </td>
                <td className="px-1.5 py-3 text-muted">{PRIORITY_LABEL[task.priority]}</td>
                <td className="px-1.5 py-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      STATUS_BADGE[task.status] ?? "bg-border text-foreground"
                    }`}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-1.5 py-6 text-center text-muted">
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
