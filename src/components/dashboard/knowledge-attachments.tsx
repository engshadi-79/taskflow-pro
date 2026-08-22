"use client";

import { useActionState, useState } from "react";
import {
  uploadKnowledgeAttachment,
  deleteKnowledgeAttachment,
  type KnowledgeFormState,
} from "@/lib/actions/knowledge";
import { DownloadIcon } from "@/components/shared/icons";

const initialState: KnowledgeFormState = {};
type AttachmentWithUrl = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  signedUrl: string | null;
};

export function KnowledgeAttachments({
  articleId,
  attachments,
  currentUserId,
  canDeleteAny,
}: {
  articleId: string;
  attachments: AttachmentWithUrl[];
  currentUserId: string;
  canDeleteAny: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadKnowledgeAttachment, initialState);

  const images = attachments.filter((a) => a.file_type?.startsWith("image/"));
  const files = attachments.filter((a) => !a.file_type?.startsWith("image/"));

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold text-muted">لقطات توضيحية</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {images.map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-[10px] border border-border">
                {a.signedUrl ? (
                  <a href={a.signedUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.signedUrl} alt={a.file_name} className="h-32 w-full object-cover" />
                  </a>
                ) : (
                  <div className="flex h-32 items-center justify-center bg-background text-[11px] text-faint">
                    {a.file_name}
                  </div>
                )}
                {(canDeleteAny || a.uploaded_by === currentUserId) && (
                  <div className="absolute inset-x-0 bottom-0 flex justify-end bg-black/40 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <DeleteButton id={a.id} articleId={articleId} filePath={a.file_url} light />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {files.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
          >
            {a.signedUrl ? (
              <a
                href={a.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-accent-600 hover:underline"
              >
                <DownloadIcon className="h-4 w-4" />
                {a.file_name}
              </a>
            ) : (
              <span className="text-muted">{a.file_name}</span>
            )}
            {(canDeleteAny || a.uploaded_by === currentUserId) && (
              <DeleteButton id={a.id} articleId={articleId} filePath={a.file_url} />
            )}
          </li>
        ))}
        {attachments.length === 0 && <p className="text-sm text-muted">لا توجد مرفقات بعد</p>}
      </ul>

      <form action={formAction} className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="article_id" value={articleId} />
        <input
          type="file"
          name="file"
          required
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          رفع
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <p className="text-[11px] text-faint">
        ارفع صورة (لقطة شاشة) لتظهر كتوضيح مرئي أعلى المرفقات، أو أي ملف آخر كمستند عادي.
      </p>
    </div>
  );
}

function DeleteButton({
  id,
  articleId,
  filePath,
  light,
}: {
  id: string;
  articleId: string;
  filePath: string;
  light?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await deleteKnowledgeAttachment(id, articleId, filePath);
        setPending(false);
      }}
      className={`text-xs hover:underline disabled:opacity-60 ${light ? "font-bold text-white" : "text-red-600"}`}
    >
      حذف
    </button>
  );
}
