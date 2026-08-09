"use client";

import { useActionState, useState } from "react";
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  type ChecklistFormState,
} from "@/lib/actions/checklists";
import { CheckIcon } from "@/components/shared/icons";
import type { TaskChecklistItem } from "@/lib/types/project";

const initialState: ChecklistFormState = {};

export function ChecklistSection({
  taskId,
  items,
}: {
  taskId: string;
  items: TaskChecklistItem[];
}) {
  const [state, formAction, pending] = useActionState(addChecklistItem, initialState);
  const total = items.length;
  const completed = items.filter((i) => i.is_completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">قائمة التحقق</h2>
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
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} taskId={taskId} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">لا توجد خطوات بعد</p>}
      </ul>

      <form action={formAction} className="flex items-center gap-2.5">
        <input type="hidden" name="task_id" value={taskId} />
        <input
          name="content"
          placeholder="أضف خطوة..."
          required
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          إضافة
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function ChecklistRow({ item, taskId }: { item: TaskChecklistItem; taskId: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <li className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-background">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await toggleChecklistItem(item.id, taskId, !item.is_completed);
          setBusy(false);
        }}
        aria-pressed={item.is_completed}
        aria-label={item.is_completed ? "إلغاء الإكمال" : "تحديد كمكتمل"}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 ${
          item.is_completed ? "border-green-500 bg-green-500 text-white" : "border-border"
        }`}
      >
        {item.is_completed && <CheckIcon className="h-3 w-3 stroke-[3]" />}
      </button>
      <span
        className={`flex-1 text-sm ${item.is_completed ? "text-faint line-through" : "text-foreground"}`}
      >
        {item.content}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await deleteChecklistItem(item.id, taskId);
          setBusy(false);
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-60"
      >
        حذف
      </button>
    </li>
  );
}
