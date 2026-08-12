"use client";

import { useActionState, useState } from "react";
import { addPersonalNote, deletePersonalNote, type NoteFormState } from "@/lib/actions/notes";
import { NoteIcon, PlusIcon, CloseIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";

const initialState: NoteFormState = {};

type Note = { id: string; content: string; created_at: string };

/**
 * Private per-user scratchpad, unrelated to tasks - every role gets this,
 * not just `employee`. `notes` is server-fetched and passed down; add/
 * delete both call revalidatePath("/dashboard", "layout") so the parent
 * Server Component re-fetches and this just re-renders with the fresh
 * prop, no local list state to keep in sync.
 */
export function MyNotesWidget({ notes }: { notes: Note[] }) {
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(addPersonalNote, initialState);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-orange-600"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          جديد
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-[14.5px] font-extrabold text-foreground">ملاحظاتي</h2>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <NoteIcon className="h-4 w-4" />
          </span>
        </div>
      </div>

      {adding && (
        <form
          action={formAction}
          onSubmit={() => setAdding(false)}
          className="mb-4 flex items-start gap-2"
        >
          <textarea
            name="content"
            rows={2}
            required
            autoFocus
            placeholder="اكتب ملاحظتك هنا..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent-500 px-3 py-2 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            حفظ
          </button>
        </form>
      )}
      {state?.error && <p className="mb-3 text-[12px] text-red-600">{state.error}</p>}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <NoteIcon className="h-6 w-6" />
          </span>
          <p className="text-[13px] text-muted">لا توجد ملاحظات، أضف ملاحظة جديدة!</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-[13px] text-foreground">{note.content}</p>
                <p className="mt-1 text-[10.5px] text-faint">{timeAgo(note.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => deletePersonalNote(note.id)}
                className="shrink-0 rounded p-1 text-muted hover:bg-surface hover:text-red-500"
                aria-label="حذف الملاحظة"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
