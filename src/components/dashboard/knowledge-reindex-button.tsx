"use client";

import { useState, useTransition } from "react";
import { reindexKnowledgeEmbeddings } from "@/lib/actions/knowledge";

export function KnowledgeReindexButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function go() {
    setMessage(null);
    startTransition(async () => {
      const result = await reindexKnowledgeEmbeddings();
      if (result.error) {
        setMessage(result.error);
      } else if (result.processed === 0 && result.remaining === 0) {
        setMessage("كل المقالات مفهرَسة دلاليًا بالفعل");
      } else {
        setMessage(
          `تمت فهرسة ${result.processed} مقال${result.remaining ? ` — تبقّى ${result.remaining}، اضغط مجددًا` : ""}`
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={go}
        title="يولّد بحثًا دلاليًا (Embeddings) للمقالات التي لا تزال بلا فهرسة"
        className="rounded-full border border-border bg-surface px-3.5 py-2 text-[12.5px] font-bold text-muted hover:bg-background disabled:opacity-60"
      >
        {pending ? "جارِ الفهرسة..." : "إعادة فهرسة دلالية"}
      </button>
      {message && <span className="text-[12px] text-muted">{message}</span>}
    </div>
  );
}
