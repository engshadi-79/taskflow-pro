"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addComment } from "@/lib/actions/tasks";
import { enqueue } from "@/lib/offline/queue";
import { OfflineBanner } from "@/components/mobile/offline-status";
import { timeAgo } from "@/lib/format-time-ago";
import type { TaskCommentWithAuthor } from "@/lib/types/task";

export function MobileTaskComments({ taskId, comments }: { taskId: string; comments: TaskCommentWithAuthor[] }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedComments, setQueuedComments] = useState<string[]>([]);

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);

    async function queueOffline() {
      await enqueue({ kind: "comment", taskId, content: trimmed });
      setQueuedComments((prev) => [...prev, trimmed]);
      setContent("");
      setPending(false);
    }

    if (!navigator.onLine) {
      await queueOffline();
      return;
    }
    try {
      const formData = new FormData();
      formData.set("task_id", taskId);
      formData.set("content", trimmed);
      const result = await addComment({}, formData);
      setPending(false);
      if (result?.error) setError(result.error);
      else {
        setContent("");
        router.refresh();
      }
    } catch {
      await queueOffline();
    }
  }

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
        {queuedComments.map((text, i) => (
          <div key={`queued-${i}`} className="rounded-[12px] bg-amber-50 p-3">
            <div className="mt-1 text-[12.5px] text-muted">{text}</div>
            <div className="mt-1.5"><OfflineBanner /></div>
          </div>
        ))}
        {comments.length === 0 && queuedComments.length === 0 && (
          <p className="text-[12.5px] text-muted">لا توجد تعليقات بعد</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="اكتب تعليقًا..."
          className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !content.trim()}
          className="rounded-[10px] bg-accent-500 px-3.5 text-[12px] font-extrabold text-white disabled:opacity-60"
        >
          إرسال
        </button>
      </div>
      {error && <p className="mt-1 text-[11.5px] text-brand-red-600">{error}</p>}
    </div>
  );
}
