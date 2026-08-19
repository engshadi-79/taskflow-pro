"use client";

import { useActionState } from "react";
import { addComment, type TaskFormState } from "@/lib/actions/tasks";
import { timeAgo } from "@/lib/format-time-ago";
import type { TaskCommentWithAuthor } from "@/lib/types/task";

const initialState: TaskFormState = {};

export function MobileTaskComments({ taskId, comments }: { taskId: string; comments: TaskCommentWithAuthor[] }) {
  const [state, formAction, pending] = useActionState(addComment, initialState);

  return (
    <div>
      <div className="mb-2.5 text-[13px] font-extrabold text-foreground">التعليقات</div>
      <div className="mb-2.5 flex flex-col gap-2.5">
        {comments.map((c) => (
          <div key={c.id} className="rounded-[12px] bg-background p-3">
            <div className="flex justify-between">
              <span className="text-[12px] font-extrabold text-foreground">{c.author_name}</span>
              <span className="text-[10.5px] text-faint">{timeAgo(c.created_at)}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-muted">{c.content}</div>
          </div>
        ))}
        {comments.length === 0 && <p className="text-[12.5px] text-muted">لا توجد تعليقات بعد</p>}
      </div>
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input
          name="content"
          placeholder="اكتب تعليقًا..."
          required
          className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-3.5 text-[12px] font-extrabold text-white disabled:opacity-60"
        >
          إرسال
        </button>
      </form>
      {state?.error && <p className="mt-1 text-[11.5px] text-brand-red-600">{state.error}</p>}
    </div>
  );
}
