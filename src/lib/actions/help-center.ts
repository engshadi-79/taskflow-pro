"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type HelpCenterActionState = { error?: string };

export async function voteOnArticle(articleId: string, vote: "up" | "down"): Promise<HelpCenterActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.from("knowledge_article_votes").upsert(
    { article_id: articleId, user_id: profile.id, vote, updated_at: new Date().toISOString() },
    { onConflict: "article_id,user_id" }
  );

  if (error) return { error: "تعذر تسجيل تقييمك" };

  revalidatePath(`/dashboard/knowledge/${articleId}`);
  return {};
}

/** Best-effort - a failed view count bump should never break the article page. */
export async function recordArticleView(articleId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_article_view", { p_article_id: articleId });
}

export type SearchSuggestion = { id: string; title: string; category: string };

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_knowledge_suggestions", { p_query: trimmed, p_limit: 6 });
  return (data as SearchSuggestion[] | null) ?? [];
}
