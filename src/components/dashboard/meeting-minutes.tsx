"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  addMinuteItem,
  convertMinuteToTask,
  deleteMinuteItem,
  type MeetingFormState,
} from "@/lib/actions/meetings";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";
import type { MeetingMinuteItem } from "@/lib/types/meeting";

const initialState: MeetingFormState = {};
type EmployeeOption = { id: string; full_name: string };

export function MeetingMinutes({
  meetingId,
  items,
  employees,
  canManage,
}: {
  meetingId: string;
  items: MeetingMinuteItem[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(addMinuteItem, initialState);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <MinuteRow key={item.id} item={item} meetingId={meetingId} employees={employees} canManage={canManage} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">لا يوجد محضر بعد</p>}
      </ul>

      <form action={formAction} className="flex items-center gap-2.5">
        <input type="hidden" name="meeting_id" value={meetingId} />
        <input
          name="content"
          placeholder="أضف بندًا للمحضر..."
          required
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
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
    </div>
  );
}

function MinuteRow({
  item,
  meetingId,
  employees,
  canManage,
}: {
  item: MeetingMinuteItem;
  meetingId: string;
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [converting, setConverting] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-[12px] border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground">{item.content}</span>
        {canManage && !item.converted_task_id && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setConverting((c) => !c)}
              className="text-xs font-bold text-accent-600 hover:underline"
            >
              تحويل لمهمة
            </button>
            <DeleteButton id={item.id} meetingId={meetingId} />
          </div>
        )}
        {item.converted_task_id && (
          <Link
            href={`/dashboard/tasks/${item.converted_task_id}`}
            className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-extrabold text-green-600 hover:underline"
          >
            تم إنشاء مهمة ←
          </Link>
        )}
      </div>

      {converting && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-border pt-2.5">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
          >
            <option value="">اختر الموظف المسند إليه</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!assignee || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await convertMinuteToTask(item.id, meetingId, assignee, dueDate || null, priority);
              setBusy(false);
              if (result?.error) setError(result.error);
              else setConverting(false);
            }}
            className="rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            تأكيد التحويل
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}

function DeleteButton({ id, meetingId }: { id: string; meetingId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await deleteMinuteItem(id, meetingId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
