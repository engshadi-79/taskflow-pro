"use client";

import { useActionState, useState } from "react";
import { addChecklistItem, toggleChecklistItem, type ChecklistFormState } from "@/lib/actions/checklists";
import type { TaskChecklistItem } from "@/lib/types/project";

const initialState: ChecklistFormState = {};

export function MobileTaskChecklist({ taskId, items }: { taskId: string; items: TaskChecklistItem[] }) {
  const [state, formAction, pending] = useActionState(addChecklistItem, initialState);

  return (
    <div>
      <div className="mb-2.5 text-[13px] font-extrabold text-foreground">قائمة التحقق</div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} taskId={taskId} />
        ))}
        {items.length === 0 && <p className="text-[12.5px] text-muted">لا توجد خطوات بعد</p>}
      </div>
      <form action={formAction} className="mt-2.5 flex gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input
          name="content"
          placeholder="أضف خطوة..."
          required
          className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-3.5 text-[12px] font-extrabold text-white disabled:opacity-60"
        >
          إضافة
        </button>
      </form>
      {state?.error && <p className="mt-1 text-[11.5px] text-brand-red-600">{state.error}</p>}
    </div>
  );
}

function ChecklistRow({ item, taskId }: { item: TaskChecklistItem; taskId: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await toggleChecklistItem(item.id, taskId, !item.is_completed);
        setBusy(false);
      }}
      className="flex items-center gap-2.5 text-start"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 ${
          item.is_completed ? "border-accent-500 bg-accent-500" : "border-border"
        }`}
      >
        {item.is_completed && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-[13px] font-semibold ${item.is_completed ? "text-faint line-through" : "text-foreground"}`}>
        {item.content}
      </span>
    </button>
  );
}
