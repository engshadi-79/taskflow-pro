"use client";

import { useActionState, useState } from "react";
import {
  uploadWorkflowRequestAttachment,
  deleteWorkflowRequestAttachment,
  type WorkflowFormState,
} from "@/lib/actions/workflow";
import { PaperclipIcon } from "@/components/shared/icons";
import type { WorkflowRequestAttachment } from "@/lib/types/workflow";

const initialState: WorkflowFormState = {};
const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

type AttachmentWithUrl = WorkflowRequestAttachment & { signedUrl: string | null };

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export function WorkflowRequestAttachments({
  requestId,
  attachments,
  currentUserId,
  canUpload,
  canDeleteAny,
}: {
  requestId: string;
  attachments: AttachmentWithUrl[];
  currentUserId: string;
  /** Attachments only make sense while the request can still change - a
   * draft the requester owns, or a pending request they submitted. */
  canUpload: boolean;
  canDeleteAny: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadWorkflowRequestAttachment, initialState);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <h2 className="mb-3 text-sm font-extrabold text-foreground">المرفقات</h2>

      <ul className="space-y-2">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <PaperclipIcon className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0">
                {a.signedUrl ? (
                  <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-accent-600 hover:underline">
                    {a.file_name}
                  </a>
                ) : (
                  <span className="truncate font-bold text-foreground">{a.file_name}</span>
                )}
                <p className="text-[11px] text-faint">{formatSize(a.file_size)}</p>
              </div>
            </div>
            {(a.uploaded_by === currentUserId || canDeleteAny) && (
              <button
                type="button"
                disabled={deletingId === a.id}
                onClick={async () => {
                  if (!confirm("حذف هذا المرفق؟")) return;
                  setDeletingId(a.id);
                  await deleteWorkflowRequestAttachment(a.id, requestId, a.file_url);
                  setDeletingId(null);
                }}
                className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-60"
              >
                حذف
              </button>
            )}
          </li>
        ))}
        {attachments.length === 0 && <p className="text-sm text-muted">لا توجد مرفقات بعد</p>}
      </ul>

      {canUpload && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="request_id" value={requestId} />
          <div>
            <input type="file" name="file" required accept={ACCEPTED_TYPES} className="text-sm text-foreground" />
            <p className="mt-1 text-[11px] text-faint">الحد الأقصى 20 ميجابايت</p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? "جارٍ الرفع..." : "رفع ملف"}
          </button>
        </form>
      )}
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
