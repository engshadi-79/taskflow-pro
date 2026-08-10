"use client";

import { useState } from "react";
import { setArticleStatus, deleteArticle } from "@/lib/actions/knowledge";
import { KNOWLEDGE_STATUS_LABEL, type KnowledgeStatus } from "@/lib/types/knowledge";

const STATUS_BADGE: Record<KnowledgeStatus, string> = {
  draft: "bg-border text-muted",
  published: "bg-green-50 text-green-600",
  archived: "bg-orange-50 text-orange-600",
};

export function ArticleStatusActions({
  articleId,
  status,
  canManage,
  canDelete,
}: {
  articleId: string;
  status: KnowledgeStatus;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [pending, setPending] = useState(false);

  if (!canManage) {
    return (
      <span className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold ${STATUS_BADGE[status]}`}>
        {KNOWLEDGE_STATUS_LABEL[status]}
      </span>
    );
  }

  async function go(next: KnowledgeStatus) {
    setPending(true);
    await setArticleStatus(articleId, next);
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold ${STATUS_BADGE[status]}`}>
        {KNOWLEDGE_STATUS_LABEL[status]}
      </span>
      {status !== "published" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => go("published")}
          className="rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-bold text-green-600 hover:bg-green-100 disabled:opacity-60"
        >
          نشر
        </button>
      )}
      {status !== "archived" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => go("archived")}
          className="rounded-full bg-orange-50 px-3 py-1.5 text-[12px] font-bold text-orange-600 hover:bg-orange-100 disabled:opacity-60"
        >
          أرشفة
        </button>
      )}
      {status !== "draft" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => go("draft")}
          className="rounded-full bg-border px-3 py-1.5 text-[12px] font-bold text-muted hover:bg-background disabled:opacity-60"
        >
          إلى مسودة
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (!confirm("حذف هذا المقال نهائيًا؟")) return;
            setPending(true);
            await deleteArticle(articleId);
            setPending(false);
          }}
          className="text-[12px] text-red-600 hover:underline disabled:opacity-60"
        >
          حذف
        </button>
      )}
    </div>
  );
}
