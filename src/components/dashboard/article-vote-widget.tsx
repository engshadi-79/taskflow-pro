"use client";

import { useState } from "react";
import { voteOnArticle } from "@/lib/actions/help-center";
import { CheckIcon, ThumbsDownIcon, ThumbsUpIcon } from "@/components/shared/icons";

export function ArticleVoteWidget({
  articleId,
  initialVote,
}: {
  articleId: string;
  initialVote: "up" | "down" | null;
}) {
  const [vote, setVote] = useState(initialVote);
  const [pending, setPending] = useState(false);

  async function handleVote(value: "up" | "down") {
    setPending(true);
    const result = await voteOnArticle(articleId, value);
    setPending(false);
    if (!result.error) setVote(value);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <p className="text-[13.5px] font-extrabold text-foreground">هل كانت هذه المقالة مفيدة؟</p>
      {vote ? (
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-green-600">
          <CheckIcon className="h-4 w-4" /> شكرًا لتقييمك
        </span>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleVote("up")}
            className="flex items-center gap-1.5 rounded-[11px] border border-border px-4 py-2 text-[12.5px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600 disabled:opacity-60"
          >
            <ThumbsUpIcon className="h-3.5 w-3.5" /> نعم
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleVote("down")}
            className="flex items-center gap-1.5 rounded-[11px] border border-border px-4 py-2 text-[12.5px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600 disabled:opacity-60"
          >
            <ThumbsDownIcon className="h-3.5 w-3.5" /> لا
          </button>
        </div>
      )}
    </div>
  );
}
