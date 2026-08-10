"use client";

import { useActionState, useState } from "react";
import { addAgendaItem, deleteAgendaItem, type MeetingFormState } from "@/lib/actions/meetings";
import type { MeetingAgendaItem } from "@/lib/types/meeting";

const initialState: MeetingFormState = {};

export function MeetingAgenda({
  meetingId,
  items,
  canManage,
}: {
  meetingId: string;
  items: MeetingAgendaItem[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(addAgendaItem, initialState);

  return (
    <div className="space-y-3">
      <ol className="list-inside list-decimal space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span>{item.content}</span>
            {canManage && <DeleteButton id={item.id} meetingId={meetingId} />}
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">لا يوجد جدول أعمال بعد</p>}
      </ol>

      {canManage && (
        <form action={formAction} className="flex items-center gap-2.5">
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input
            name="content"
            placeholder="أضف بندًا..."
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
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
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
        await deleteAgendaItem(id, meetingId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
