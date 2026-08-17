import Link from "next/link";
import { CATEGORY_ICON_MAP, CATEGORY_TONE_CLASSES } from "@/lib/knowledge/category-style";
import { ChevronLeftIcon, EyeIcon } from "@/components/shared/icons";
import type { KnowledgeArticle, KnowledgeCategoryRow } from "@/lib/types/knowledge";

export function HelpArticleRow({
  article,
  category,
  showCategory = true,
}: {
  article: KnowledgeArticle;
  category?: KnowledgeCategoryRow;
  showCategory?: boolean;
}) {
  const tone = category ? CATEGORY_TONE_CLASSES[category.tone] : CATEGORY_TONE_CLASSES.indigo;
  const Icon = category ? CATEGORY_ICON_MAP[category.icon] : undefined;

  return (
    <Link
      href={`/dashboard/knowledge/${article.id}`}
      className="flex items-center gap-3.5 rounded-[16px] border border-border bg-surface p-4 transition-colors hover:border-accent-500 hover:shadow-sm"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${tone.bg} ${tone.fg}`}>
        {Icon ? <Icon className="h-[19px] w-[19px]" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold text-foreground">{article.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-faint">
          {showCategory && category && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${tone.bg} ${tone.fg}`}>
              {category.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <EyeIcon className="h-3.5 w-3.5" /> {article.view_count} مشاهدة
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-[10px] bg-accent-500 px-3.5 py-2 text-[12.5px] font-bold text-white sm:flex">
        عرض <ChevronLeftIcon className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
