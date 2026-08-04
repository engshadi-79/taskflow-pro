"use client";

import { useActionState, useState } from "react";
import { uploadAttachment, deleteAttachment, type TaskFormState } from "@/lib/actions/tasks";
import type { TaskAttachment } from "@/lib/types/task";

const initialState: TaskFormState = {};

type AttachmentWithUrl = TaskAttachment & { signedUrl: string | null };

export function AttachmentsSection({
  taskId,
  attachments,
  currentUserId,
  canDeleteAny,
}: {
  taskId: string;
  attachments: AttachmentWithUrl[];
  currentUserId: string;
  canDeleteAny: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadAttachment, initialState);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">المرفقات</h2>

      <ul className="space-y-2">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {attachment.signedUrl ? (
              <a
                href={attachment.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline"
              >
                {attachment.file_name}
              </a>
            ) : (
              <span className="text-muted">{attachment.file_name}</span>
            )}
            {(attachment.uploaded_by === currentUserId || canDeleteAny) && (
              <DeleteAttachmentButton id={attachment.id} taskId={taskId} filePath={attachment.file_url} />
            )}
          </li>
        ))}
        {attachments.length === 0 && <p className="text-sm text-muted">لا توجد مرفقات بعد</p>}
      </ul>

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="task_id" value={taskId} />
        <input type="file" name="file" required className="text-sm text-foreground" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الرفع..." : "رفع ملف"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function DeleteAttachmentButton({
  id,
  taskId,
  filePath,
}: {
  id: string;
  taskId: string;
  filePath: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("حذف هذا المرفق؟")) return;
        setPending(true);
        await deleteAttachment(id, taskId, filePath);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
