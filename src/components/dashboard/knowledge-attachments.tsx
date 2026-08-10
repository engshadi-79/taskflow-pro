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

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {attachments.map((a) => (
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

      <form action={formAction} className="flex items-center gap-2.5">
        <input type="hidden" name="article_id" value={articleId} />
        <input
          type="file"
          name="file"
          required
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent-500"
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
    </div>
  );
}

function DeleteButton({ id, articleId, filePath }: { id: string; articleId: string; filePath: string }) {
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
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
