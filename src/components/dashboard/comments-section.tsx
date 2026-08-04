"use client";

import { useActionState, useState } from "react";
import { addComment, deleteComment, type TaskFormState } from "@/lib/actions/tasks";
import type { TaskCommentWithAuthor } from "@/lib/types/task";

const initialState: TaskFormState = {};

export function CommentsSection({
  taskId,
  comments,
  currentUserId,
  canDeleteAny,
}: {
  taskId: string;
  comments: TaskCommentWithAuthor[];
  currentUserId: string;
  canDeleteAny: boolean;
}) {
  const [state, formAction, pending] = useActionState(addComment, initialState);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">الملاحظات والتعليقات</h2>

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-foreground">
                {comment.author?.full_name ?? "مستخدم محذوف"}
              </span>
              {(comment.user_id === currentUserId || canDeleteAny) && (
                <DeleteCommentButton id={comment.id} taskId={taskId} />
              )}
            </div>
            <p className="text-foreground/90">{comment.content}</p>
          </li>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted">لا توجد تعليقات بعد</p>}
      </ul>

      <form action={formAction} className="flex items-start gap-3">
        <input type="hidden" name="task_id" value={taskId} />
        <textarea
          name="content"
          rows={2}
          required
          placeholder="أضف تعليقًا..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          إرسال
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function DeleteCommentButton({ id, taskId }: { id: string; taskId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await deleteComment(id, taskId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
