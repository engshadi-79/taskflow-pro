"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addDependency, removeDependency, type DependencyFormState } from "@/lib/actions/dependencies";
import { DEPENDENCY_TYPE_LABEL, type DependencyType } from "@/lib/types/project";
import { STATUS_LABEL, type TaskStatus } from "@/lib/types/task";

type DependencyRow = {
  id: string;
  dependency_type: DependencyType;
  task: { id: string; title: string; status: TaskStatus };
};
type TaskOption = { id: string; title: string };

const initialState: DependencyFormState = {};

export function DependenciesSection({
  taskId,
  dependsOn,
  blocks,
  otherTasks,
  canManage,
}: {
  taskId: string;
  /** Tasks this one depends on - deletable from here. */
  dependsOn: DependencyRow[];
  /** Tasks that depend on this one - read-only here, managed from their own page. */
  blocks: DependencyRow[];
  otherTasks: TaskOption[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(addDependency, initialState);

  return (
    <section className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      <h2 className="text-sm font-extrabold text-foreground">التبعيات</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[12.5px] font-bold text-muted">تعتمد على (Depends On)</h3>
          <ul className="space-y-1.5">
            {dependsOn.map((dep) => (
              <li key={dep.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
                <Link href={`/dashboard/tasks/${dep.task.id}`} className="flex-1 truncate text-foreground hover:text-accent-600">
                  {dep.task.title}
                </Link>
                <span className="shrink-0 text-[11px] text-muted">{DEPENDENCY_TYPE_LABEL[dep.dependency_type]}</span>
                <span className="shrink-0 text-[11px] font-bold text-muted">{STATUS_LABEL[dep.task.status]}</span>
                {canManage && <DeleteButton id={dep.id} taskId={taskId} />}
              </li>
            ))}
            {dependsOn.length === 0 && <p className="text-sm text-muted">لا توجد تبعيات</p>}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-[12.5px] font-bold text-muted">تعيق (Blocks)</h3>
          <ul className="space-y-1.5">
            {blocks.map((dep) => (
              <li key={dep.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
                <Link href={`/dashboard/tasks/${dep.task.id}`} className="flex-1 truncate text-foreground hover:text-accent-600">
                  {dep.task.title}
                </Link>
                <span className="shrink-0 text-[11px] text-muted">{DEPENDENCY_TYPE_LABEL[dep.dependency_type]}</span>
                <span className="shrink-0 text-[11px] font-bold text-muted">{STATUS_LABEL[dep.task.status]}</span>
              </li>
            ))}
            {blocks.length === 0 && <p className="text-sm text-muted">لا توجد مهام تعتمد على هذه</p>}
          </ul>
        </div>
      </div>

      {canManage && otherTasks.length > 0 && (
        <form action={formAction} className="flex flex-wrap items-end gap-2.5 border-t border-border pt-3.5">
          <input type="hidden" name="task_id" value={taskId} />
          <select
            name="depends_on_task_id"
            required
            defaultValue=""
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            <option value="" disabled>
              اختر مهمة
            </option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select
            name="dependency_type"
            defaultValue="finish_to_start"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            {(Object.keys(DEPENDENCY_TYPE_LABEL) as DependencyType[]).map((type) => (
              <option key={type} value={type}>
                {DEPENDENCY_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة تبعية
          </button>
        </form>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function DeleteButton({ id, taskId }: { id: string; taskId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await removeDependency(id, taskId);
        setPending(false);
      }}
      className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
