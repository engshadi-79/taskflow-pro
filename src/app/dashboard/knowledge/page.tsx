import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { FolderIcon, PlusIcon, SearchIcon } from "@/components/shared/icons";
import { searchKnowledgeArticles } from "@/lib/knowledge/search";
import { KnowledgeReindexButton } from "@/components/dashboard/knowledge-reindex-button";
import {
  KNOWLEDGE_CATEGORY_LABEL,
  KNOWLEDGE_STATUS_LABEL,
  type KnowledgeArticle,
  type KnowledgeCategory,
} from "@/lib/types/knowledge";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;
  const category = params.category || "";
  const query = params.q?.trim() || "";

  const supabase = await createClient();

  let articles: KnowledgeArticle[] = [];
  if (query) {
    articles = await searchKnowledgeArticles(supabase, query);
  } else {
    let listQuery = supabase.from("knowledge_articles").select("*").order("updated_at", { ascending: false });
    if (category) listQuery = listQuery.eq("category", category);
    const { data } = await listQuery.returns<KnowledgeArticle[]>();
    articles = data ?? [];
  }

  const canCreate = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <PageHeader
        title="قاعدة المعرفة"
        subtitle="السياسات والإجراءات والنماذج والأدلة في مكان واحد"
        variant="navy"
        icon={<FolderIcon className="h-6 w-6" />}
        count={`${articles.length} مقال`}
      >
        {canCreate && (
          <Link
            href="/dashboard/knowledge/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" />
            مقال جديد
          </Link>
        )}
      </PageHeader>

      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/knowledge"
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
              !category ? "bg-foreground text-surface" : "border border-border bg-surface text-muted"
            }`}
          >
            الكل
          </Link>
          {(Object.keys(KNOWLEDGE_CATEGORY_LABEL) as KnowledgeCategory[]).map((c) => (
            <Link
              key={c}
              href={`/dashboard/knowledge?category=${c}`}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
                category === c ? "bg-foreground text-surface" : "border border-border bg-surface text-muted"
              }`}
            >
              {KNOWLEDGE_CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {profile.role === "super_admin" && <KnowledgeReindexButton />}
          <form method="get" className="relative">
            <SearchIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="بحث..."
              className="w-55 rounded-full border border-border bg-surface py-2 pe-9 ps-4 text-[13px] text-foreground placeholder:text-faint focus:border-accent-500 focus:outline-none"
            />
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/knowledge/${a.id}`}
            className="flex flex-col gap-2 rounded-[18px] border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-extrabold text-accent-600">
                {KNOWLEDGE_CATEGORY_LABEL[a.category]}
              </span>
              <span className="text-[11px] font-bold text-muted">{KNOWLEDGE_STATUS_LABEL[a.status]}</span>
            </div>
            <h3 className="font-display text-[15px] text-foreground">{a.title}</h3>
            <p className="line-clamp-2 text-[12.5px] text-muted">{a.content}</p>
          </Link>
        ))}
        {articles.length === 0 && (
          <div className="rounded-[18px] border border-border bg-surface p-10 text-center text-muted sm:col-span-2 lg:col-span-3">
            لا توجد مقالات مطابقة
          </div>
        )}
      </div>
    </div>
  );
}
