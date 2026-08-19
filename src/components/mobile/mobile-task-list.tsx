"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MOBILE_PRIORITY_STYLE, MOBILE_STATUS_STYLE } from "@/lib/mobile-theme";
import { PRIORITY_LABEL, STATUS_LABEL, type TaskStatus, type TaskWithAssignee } from "@/lib/types/task";

const FILTERS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "new", label: "جديدة" },
  { key: "in_progress", label: "قيد التنفيذ" },
  { key: "pending_review", label: "بانتظار المراجعة" },
  { key: "completed", label: "مكتملة" },
  { key: "overdue", label: "متأخرة" },
];

export function MobileTaskList({ tasks }: { tasks: TaskWithAssignee[] }) {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const filtered = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-background px-4 pb-3">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${
                active ? "border-accent-600 bg-accent-600 text-white" : "border-border bg-surface text-muted"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2.5 px-4 pb-6">
        {filtered.map((task) => (
          <Link
            key={task.id}
            href={`/m/tasks/${task.id}`}
            className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">{task.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${MOBILE_STATUS_STYLE[task.status].badge}`}
              >
                {STATUS_LABEL[task.status]}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-muted">
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${MOBILE_PRIORITY_STYLE[task.priority].dot}`} />
              <span className={MOBILE_PRIORITY_STYLE[task.priority].text}>{PRIORITY_LABEL[task.priority]}</span>
              <span className="text-border">|</span>
              <span className="truncate">{task.assignee?.full_name ?? "—"}</span>
              <span className="ms-auto shrink-0">{task.due_date ?? "بدون موعد"}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد مهام</p>}
      </div>
    </div>
  );
}
