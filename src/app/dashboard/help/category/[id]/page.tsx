import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCategoryWithArticles } from "@/lib/data/help-center";
import { HelpBreadcrumb } from "@/components/dashboard/help-breadcrumb";
import { HelpSidebarCategories, HelpQuickLinks } from "@/components/dashboard/help-sidebar";
import { HelpArticleRow } from "@/components/dashboard/help-article-row";
import { CATEGORY_ICON_MAP, CATEGORY_TONE_CLASSES } from "@/lib/knowledge/category-style";

export default async function HelpCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const { category, articles, categories, total } = await getCategoryWithArticles(id);
  if (!category) notFound();

  const tone = CATEGORY_TONE_CLASSES[category.tone];
  const Icon = CATEGORY_ICON_MAP[category.icon];
  const topArticle = [...articles].sort((a, b) => b.view_count - a.view_count)[0] ?? null;

  return (
    <div>
      <HelpBreadcrumb items={[{ label: category.name }]} />

      <div className="mb-6 flex items-center gap-4">
        <span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-[16px] ${tone.bg} ${tone.fg}`}>
          {Icon && <Icon className="h-6 w-6" />}
        </span>
        <div>
          <h1 className="font-display text-[20px] text-foreground">{category.name}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {category.description} · {articles.length} مقالة
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {articles.length === 0 && (
            <div className="rounded-[16px] border border-border bg-surface p-10 text-center text-[13px] text-muted">
              لا توجد مقالات في هذا التصنيف بعد
            </div>
          )}
          {articles.map((a) => (
            <HelpArticleRow key={a.id} article={a} category={category} showCategory={false} />
          ))}
        </div>

        <div>
          <HelpSidebarCategories categories={categories} total={total} activeId={category.id} />
          <HelpQuickLinks topArticle={topArticle ? { id: topArticle.id, title: topArticle.title } : null} />
        </div>
      </div>
    </div>
  );
}
