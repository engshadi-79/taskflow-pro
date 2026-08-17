"use client";

import { useEffect, useRef } from "react";
import { recordArticleView } from "@/lib/actions/help-center";

/** Fire-and-forget view count bump, once per mount - never blocks or affects the page's own render. */
export function ArticleViewTracker({ articleId }: { articleId: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    Promise.resolve().then(() => {
      recordArticleView(articleId);
    });
  }, [articleId]);

  return null;
}
