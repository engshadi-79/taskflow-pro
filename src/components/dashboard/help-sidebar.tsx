import Link from "next/link";
import { CATEGORY_TONE_CLASSES } from "@/lib/knowledge/category-style";
import { BookIcon, ChatIcon, FolderIcon, GridIcon, SparklesIcon, UserIcon } from "@/components/shared/icons";
import type { CategoryWithCount } from "@/lib/data/help-center";

export function HelpSidebarCategories({
  categories,
  total,
  activeId,
}: {
  categories: CategoryWithCount[];
  total: number;
  activeId?: string;
}) {
  return (
    <div className="mb-4 rounded-[18px] border border-border bg-surface p-4.5">
      <h3 className="mb-3.5 flex items-center gap-2 text-[13.5px] font-extrabold text-foreground">
        <FolderIcon className="h-4 w-4" /> التصنيفات
      </h3>
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/help"
          className={`flex items-center justify-between rounded-[11px] px-3 py-2.5 text-[13px] font-bold transition-colors ${
            !activeId ? "bg-accent-500 text-white" : "text-muted hover:bg-background hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <GridIcon className="h-4 w-4" /> جميع المواضيع
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
              !activeId ? "bg-white/20" : "bg-background text-muted"
            }`}
          >
            {total}
          </span>
        </Link>
        {categories.map((c) => {
          const active = activeId === c.id;
          const tone = CATEGORY_TONE_CLASSES[c.tone];
          return (
            <Link
              key={c.id}
              href={`/dashboard/help/category/${c.id}`}
              className={`flex items-center justify-between rounded-[11px] px-3 py-2.5 text-[13px] font-bold transition-colors ${
                active ? "bg-accent-500 text-white" : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-[3px] ${active ? "bg-white" : tone.dot}`} />
                {c.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                  active ? "bg-white/20" : "bg-background text-muted"
                }`}
              >
                {c.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function HelpQuickLinks({ topArticle }: { topArticle?: { id: string; title: string } | null }) {
  return (
    <div className="rounded-[18px] border border-border bg-surface p-4.5">
      <h3 className="mb-3.5 flex items-center gap-2 text-[13.5px] font-extrabold text-foreground">
        <SparklesIcon className="h-4 w-4" /> روابط سريعة
      </h3>
      <div className="flex flex-col gap-2">
        {topArticle && (
          <Link
            href={`/dashboard/knowledge/${topArticle.id}`}
            className="flex items-center gap-2.5 rounded-[11px] border border-border px-3 py-2.5 text-[12.5px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600"
          >
            <BookIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{topArticle.title}</span>
          </Link>
        )}
        <Link
          href="/dashboard/chat"
          className="flex items-center gap-2.5 rounded-[11px] border border-border px-3 py-2.5 text-[12.5px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600"
        >
          <ChatIcon className="h-4 w-4" /> تواصل مع فريق الدعم
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-2.5 rounded-[11px] border border-border px-3 py-2.5 text-[12.5px] font-bold text-muted transition-colors hover:border-accent-500 hover:text-accent-600"
        >
          <UserIcon className="h-4 w-4" /> الملف الشخصي وإعدادات الحساب
        </Link>
      </div>
    </div>
  );
}
