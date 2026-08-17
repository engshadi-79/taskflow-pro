import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getHelpCenterHome } from "@/lib/data/help-center";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { HelpSearchBox } from "@/components/dashboard/help-search-box";
import { HelpSidebarCategories, HelpQuickLinks } from "@/components/dashboard/help-sidebar";
import { HelpArticleRow } from "@/components/dashboard/help-article-row";
import { CATEGORY_ICON_MAP, CATEGORY_TONE_CLASSES } from "@/lib/knowledge/category-style";
import { ClockIcon, HelpIcon, StarIcon } from "@/components/shared/icons";

export default async function HelpCenterPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { categories, total, featured, recent } = await getHelpCenterHome();
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const categoryIconByCategory = Object.fromEntries(categories.map((c) => [c.id, c.icon]));
  const topArticle = [...recent].sort((a, b) => b.view_count - a.view_count)[0] ?? null;

  return (
    <div>
      <section className="banner-teal relative mb-6 overflow-hidden rounded-[20px] px-6 py-11 text-center text-white shadow-lg shadow-accent-600/15">
        <AnimatedBackground intensity="subtle" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <HelpIcon className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-2xl font-black sm:text-[28px]">مركز المساعدة</h1>
          <p className="mb-7 text-[14px] text-white/85">ابحث عن أي موضوع تحتاج مساعدة فيه</p>
          <HelpSearchBox categoryIconByCategory={categoryIconByCategory} />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-9">
            <div>
              <div className="text-[20px] font-black">{total}</div>
              <div className="text-[12px] text-white/75">مقالة مساعدة</div>
            </div>
            <div>
              <div className="text-[20px] font-black">{categories.length}</div>
              <div className="text-[12px] text-white/75">تصنيفات</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {featured.length > 0 && (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
                <StarIcon className="h-4.5 w-4.5 text-accent-500" /> مواضيع مميزة
              </h2>
              <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((a) => {
                  const cat = categoriesById.get(a.category);
                  const tone = cat ? CATEGORY_TONE_CLASSES[cat.tone] : CATEGORY_TONE_CLASSES.indigo;
                  const Icon = cat ? CATEGORY_ICON_MAP[cat.icon] : undefined;
                  return (
                    <Link
                      key={a.id}
                      href={`/dashboard/knowledge/${a.id}`}
                      className="flex items-start gap-3 rounded-[16px] border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[11px] ${tone.bg} ${tone.fg}`}>
                        {Icon && <Icon className="h-[18px] w-[18px]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold text-foreground">{a.title}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-faint">{cat?.name}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
            <ClockIcon className="h-4.5 w-4.5 text-accent-500" /> أحدث المقالات
          </h2>
          <div className="flex flex-col gap-2.5">
            {recent.length === 0 && (
              <div className="rounded-[16px] border border-border bg-surface p-8 text-center text-[13px] text-muted">
                لا توجد مقالات منشورة بعد
              </div>
            )}
            {recent.map((a) => (
              <HelpArticleRow key={a.id} article={a} category={categoriesById.get(a.category)} />
            ))}
          </div>
        </div>

        <div>
          <HelpSidebarCategories categories={categories} total={total} />
          <HelpQuickLinks topArticle={topArticle ? { id: topArticle.id, title: topArticle.title } : null} />
        </div>
      </div>
    </div>
  );
}
