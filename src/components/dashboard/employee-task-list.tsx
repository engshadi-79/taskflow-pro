import Link from "next/link";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskStatus,
  type Task,
} from "@/lib/types/task";

const STATUS_BADGE: Record<TaskStatus, string> = {
  new: "bg-border text-foreground",
  in_progress: "bg-accent-50 text-accent-700",
  pending_review: "bg-accent-100 text-accent-700",
  completed: "bg-accent-500 text-white",
  overdue: "bg-accent-900 text-white",
  cancelled: "bg-border text-muted line-through",
};

export function EmployeeTaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted">لا توجد مهام مسندة إليك حاليًا</p>;
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/dashboard/tasks/${task.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 hover:border-accent-300"
          >
            <div>
              <p className="font-medium text-foreground">{task.title}</p>
              <p
                className={`mt-1 text-sm ${
                  task.priority === "urgent" ? "font-semibold text-accent-700" : "text-muted"
                }`}
              >
                {PRIORITY_LABEL[task.priority]}
                {task.due_date ? ` — تاريخ الاستحقاق: ${task.due_date}` : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[task.status]}`}
            >
              {STATUS_LABEL[task.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
