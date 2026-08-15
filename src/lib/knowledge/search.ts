import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { KnowledgeArticle } from "@/lib/types/knowledge";

const RRF_K = 60;

/**
 * Merges keyword (tsvector, search_knowledge_articles) and semantic
 * (pgvector, match_knowledge_articles) search via reciprocal rank fusion, so
 * an article surfaces whether it contains the literal words or just means
 * the same thing. Both RPCs run on the caller's own RLS-scoped client, so a
 * draft only its author can see stays that way in both ranking paths. If
 * embedding generation fails (no API key, quota, etc.) this silently falls
 * back to keyword-only results instead of failing the whole search.
 */
export async function searchKnowledgeArticles(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<KnowledgeArticle[]> {
  const [{ data: keywordRows }, embedding] = await Promise.all([
    supabase.rpc("search_knowledge_articles", { p_query: query }),
    generateEmbedding(query),
  ]);

  const keyword = (keywordRows ?? []) as { id: string }[];

  let semantic: { id: string }[] = [];
  if (embedding) {
    const { data: semanticRows } = await supabase.rpc("match_knowledge_articles", {
      p_embedding: embedding,
      p_match_count: limit,
    });
    semantic = (semanticRows ?? []) as { id: string }[];
  }

  const scores = new Map<string, number>();
  keyword.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
  semantic.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));

  const rankedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, limit);
  if (rankedIds.length === 0) return [];

  const { data: full } = await supabase
    .from("knowledge_articles")
    .select("*")
    .in("id", rankedIds)
    .returns<KnowledgeArticle[]>();
  const byId = new Map((full ?? []).map((a) => [a.id, a]));
  return rankedIds.map((id) => byId.get(id)).filter((a): a is KnowledgeArticle => !!a);
}
