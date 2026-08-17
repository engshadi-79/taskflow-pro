import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { searchKnowledgeArticles } from "@/lib/knowledge/search";
import { getSearchSidebarData } from "@/lib/data/help-center";
import { HelpBreadcrumb } from "@/components/dashboard/help-breadcrumb";
import { HelpSidebarCategories, HelpQuickLinks } from "@/components/dashboard/help-sidebar";
import { HelpArticleRow } from "@/components/dashboard/help-article-row";
import { SearchIcon } from "@/components/shared/icons";
import type { KnowledgeCategoryRow } from "@/lib/types/knowledge";

export default async function HelpSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const [allResults, { categories, total }] = await Promise.all([
    query ? searchKnowledgeArticles(supabase, query) : Promise.resolve([]),
    getSearchSidebarData(),
  ]);
  // the help center only surfaces published material, even though the
  // shared search helper (also used by the admin knowledge list) lets a
  // manager's own drafts show up too
  const results = allResults.filter((a) => a.status === "published");
  const categoriesById = new Map<string, KnowledgeCategoryRow>(categories.map((c) => [c.id, c]));

  return (
    <div>
      <HelpBreadcrumb items={[{ label: "نتائج البحث" }]} />

      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[16px] bg-accent-50 text-accent-600">
          <SearchIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-[20px] text-foreground">نتائج البحث عن &quot;{query}&quot;</h1>
          <p className="mt-0.5 text-[13px] text-muted">{results.length} نتيجة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {results.length === 0 && (
            <div className="rounded-[16px] border border-border bg-surface p-10 text-center text-muted">
              <SearchIcon className="mx-auto mb-3 h-8 w-8 text-faint" />
              <h3 className="mb-1 text-[15px] font-extrabold text-foreground">لا توجد نتائج مطابقة</h3>
              <p className="text-[12.5px]">جرّب كلمات مفتاحية مختلفة أو تصفح التصنيفات جانبًا</p>
            </div>
          )}
          {results.map((a) => (
            <HelpArticleRow key={a.id} article={a} category={categoriesById.get(a.category)} />
          ))}
        </div>

        <div>
          <HelpSidebarCategories categories={categories} total={total} />
          <HelpQuickLinks />
        </div>
      </div>
    </div>
  );
}
