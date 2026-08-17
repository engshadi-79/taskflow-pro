import { createClient } from "@/lib/supabase/server";
import type { KnowledgeArticle, KnowledgeCategoryRow } from "@/lib/types/knowledge";

export type CategoryWithCount = KnowledgeCategoryRow & { count: number };

async function getCategoriesWithCounts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ categories: CategoryWithCount[]; total: number }> {
  const [{ data: categories }, { data: rows }] = await Promise.all([
    supabase.from("knowledge_categories").select("*").order("sort_order").returns<KnowledgeCategoryRow[]>(),
    supabase.from("knowledge_articles").select("category").eq("status", "published").returns<{ category: string }[]>(),
  ]);

  const counts = new Map<string, number>();
  (rows ?? []).forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));

  return {
    categories: (categories ?? []).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
    total: rows?.length ?? 0,
  };
}

export async function getHelpCenterHome() {
  const supabase = await createClient();

  const [{ categories, total }, { data: articles }] = await Promise.all([
    getCategoriesWithCounts(supabase),
    supabase
      .from("knowledge_articles")
      .select("*")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .returns<KnowledgeArticle[]>(),
  ]);

  const all = articles ?? [];

  return {
    categories,
    total,
    featured: all.filter((a) => a.is_featured).slice(0, 6),
    recent: all.slice(0, 6),
  };
}

export async function getCategoryWithArticles(categoryId: string) {
  const supabase = await createClient();

  const [{ data: category }, { data: articles }, { categories, total }] = await Promise.all([
    supabase.from("knowledge_categories").select("*").eq("id", categoryId).maybeSingle<KnowledgeCategoryRow>(),
    supabase
      .from("knowledge_articles")
      .select("*")
      .eq("category", categoryId)
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .returns<KnowledgeArticle[]>(),
    getCategoriesWithCounts(supabase),
  ]);

  return {
    category: category ?? null,
    articles: articles ?? [],
    categories,
    total,
  };
}

export async function getRelatedArticles(articleId: string, categoryId: string, limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_articles")
    .select("*")
    .eq("category", categoryId)
    .neq("id", articleId)
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(limit)
    .returns<KnowledgeArticle[]>();
  return data ?? [];
}

export async function getSearchSidebarData() {
  const supabase = await createClient();
  return getCategoriesWithCounts(supabase);
}
