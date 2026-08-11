"use client";

import { useActionState, useRef, useState } from "react";
import { uploadAttachment, deleteAttachment, type TaskFormState } from "@/lib/actions/tasks";
import { PaperclipIcon } from "@/components/shared/icons";
import type { TaskAttachment } from "@/lib/types/task";

const initialState: TaskFormState = {};

const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

type AttachmentWithUrl = TaskAttachment & { signedUrl: string | null };

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

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

  // group every version of the same logical document together - a version
  // never replaces/deletes an earlier row, it only points back at it via
  // original_attachment_id (see supabase/task_attachments_v2.sql)
  const groups = new Map<string, AttachmentWithUrl[]>();
  for (const a of attachments) {
    const lineageId = a.original_attachment_id ?? a.id;
    groups.set(lineageId, [...(groups.get(lineageId) ?? []), a]);
  }
  const lineages = [...groups.values()].map((versions) =>
    [...versions].sort((a, b) => b.version_number - a.version_number)
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">المرفقات</h2>

      <ul className="space-y-2">
        {lineages.map((versions) => (
          <AttachmentGroup
            key={versions[0].id}
            taskId={taskId}
            versions={versions}
            currentUserId={currentUserId}
            canDeleteAny={canDeleteAny}
          />
        ))}
        {attachments.length === 0 && <p className="text-sm text-muted">لا توجد مرفقات بعد</p>}
      </ul>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="task_id" value={taskId} />
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
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}

function AttachmentGroup({
  taskId,
  versions,
  currentUserId,
  canDeleteAny,
}: {
  taskId: string;
  versions: AttachmentWithUrl[];
  currentUserId: string;
  canDeleteAny: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const latest = versions[0];
  const isImage = latest.file_type?.startsWith("image/");
  const isPdf = latest.file_type === "application/pdf";

  return (
    <li className="rounded-lg border border-border bg-surface p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {isImage && latest.signedUrl ? (
            <a href={latest.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={latest.signedUrl}
                alt={latest.file_name}
                className="h-14 w-14 rounded-md border border-border object-cover"
              />
            </a>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted">
              <PaperclipIcon className="h-5 w-5" />
            </span>
          )}

          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{latest.file_name}</p>
            <p className="text-[11.5px] text-faint">
              {latest.version_number > 1 && <span className="font-bold text-accent-600">الإصدار {latest.version_number} — </span>}
              {formatSize(latest.file_size)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
              {isPdf && latest.signedUrl && (
                <a href={latest.signedUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-600 hover:underline">
                  معاينة
                </a>
              )}
              {latest.signedUrl && (
                <a href={latest.signedUrl} download={latest.file_name} className="font-bold text-accent-600 hover:underline">
                  تنزيل
                </a>
              )}
              <UploadVersionButton taskId={taskId} replacesId={latest.id} />
              {versions.length > 1 && (
                <button type="button" onClick={() => setShowHistory((v) => !v)} className="font-bold text-muted hover:underline">
                  {showHistory ? "إخفاء الإصدارات السابقة" : `عرض ${versions.length - 1} إصدار سابق`}
                </button>
              )}
            </div>
          </div>
        </div>

        {(latest.uploaded_by === currentUserId || canDeleteAny) && (
          <DeleteAttachmentButton id={latest.id} taskId={taskId} filePath={latest.file_url} />
        )}
      </div>

      {showHistory && versions.length > 1 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {versions.slice(1).map((v) => (
            <li key={v.id} className="flex items-center justify-between text-[12px] text-muted">
              <span>
                الإصدار {v.version_number} — {formatSize(v.file_size)}
              </span>
              <div className="flex items-center gap-2">
                {v.signedUrl && (
                  <a href={v.signedUrl} download={v.file_name} className="font-bold text-accent-600 hover:underline">
                    تنزيل
                  </a>
                )}
                {(v.uploaded_by === currentUserId || canDeleteAny) && (
                  <DeleteAttachmentButton id={v.id} taskId={taskId} filePath={v.file_url} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function UploadVersionButton({ taskId, replacesId }: { taskId: string; replacesId: string }) {
  const [state, formAction, pending] = useActionState(uploadAttachment, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="inline">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="replaces_id" value={replacesId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="font-bold text-accent-600 hover:underline disabled:opacity-60"
      >
        {pending ? "جارٍ الرفع..." : "رفع إصدار جديد"}
      </button>
      {state?.error && <p className="mt-1 text-[11px] text-red-600">{state.error}</p>}
    </form>
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
