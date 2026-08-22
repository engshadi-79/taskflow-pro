import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { getRelatedArticles } from "@/lib/data/help-center";
import { ArticleForm } from "@/components/dashboard/article-form";
import { ArticleStatusActions } from "@/components/dashboard/article-status-actions";
import { KnowledgeAttachments } from "@/components/dashboard/knowledge-attachments";
import { HelpBreadcrumb } from "@/components/dashboard/help-breadcrumb";
import { ArticleVoteWidget } from "@/components/dashboard/article-vote-widget";
import { ArticleViewTracker } from "@/components/dashboard/article-view-tracker";
import { ArticleContent } from "@/components/dashboard/article-content";
import { CATEGORY_ICON_MAP, CATEGORY_TONE_CLASSES } from "@/lib/knowledge/category-style";
import { ClockIcon, ExternalLinkIcon, EyeIcon, FolderIcon, HomeIcon, TagIcon } from "@/components/shared/icons";
import { KNOWLEDGE_CATEGORY_LABEL, type KnowledgeArticle, type KnowledgeCategoryRow } from "@/lib/types/knowledge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: article } = await supabase
    .from("knowledge_articles")
    .select("*")
    .eq("id", id)
    .single<KnowledgeArticle>();

  if (!article) {
    notFound();
  }

  const canManage = profile.role === "super_admin" || article.author_id === profile.id;
  const showEditForm = canManage && edit === "1";

  const [{ data: attachments }, { data: departments }, { data: projects }] = await Promise.all([
    supabase.from("knowledge_attachments").select("*").eq("article_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("task-attachments").createSignedUrl(a.file_url, 60 * 60);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    })
  );

  // the read view is now the default landing state for everyone, including
  // managers - editing is an explicit opt-in via ?edit=1, not the default
  let categoryRow: KnowledgeCategoryRow | null = null;
  let related: KnowledgeArticle[] = [];
  let myVote: "up" | "down" | null = null;
  if (!showEditForm) {
    const [{ data: catRow }, relatedRows, { data: voteRow }] = await Promise.all([
      supabase.from("knowledge_categories").select("*").eq("id", article.category).maybeSingle<KnowledgeCategoryRow>(),
      getRelatedArticles(article.id, article.category, 5),
      supabase
        .from("knowledge_article_votes")
        .select("vote")
        .eq("article_id", article.id)
        .eq("user_id", profile.id)
        .maybeSingle<{ vote: "up" | "down" }>(),
    ]);
    categoryRow = catRow ?? null;
    related = relatedRows;
    myVote = voteRow?.vote ?? null;
  }

  if (showEditForm) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/dashboard/knowledge/${article.id}`} className="text-[12.5px] font-bold text-accent-600 hover:underline">
              ← عرض المقالة
            </Link>
            <h1 className="font-display text-[20px] text-foreground">{article.title}</h1>
            <span className="mt-1 inline-block rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-extrabold text-accent-600">
              {KNOWLEDGE_CATEGORY_LABEL[article.category]}
            </span>
          </div>
          <ArticleStatusActions
            articleId={article.id}
            status={article.status}
            canManage={canManage}
            canDelete={profile.role === "super_admin"}
          />
        </div>

        <ArticleForm article={article} departments={departments ?? []} projects={projects ?? []} />

        <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
          <h2 className="text-sm font-extrabold text-foreground">المرفقات</h2>
          <KnowledgeAttachments
            articleId={article.id}
            attachments={attachmentsWithUrls}
            currentUserId={profile.id}
            canDeleteAny={profile.role === "super_admin"}
          />
        </section>
      </div>
    );
  }

  const tone = categoryRow ? CATEGORY_TONE_CLASSES[categoryRow.tone] : CATEGORY_TONE_CLASSES.indigo;
  const CategoryIcon = categoryRow ? CATEGORY_ICON_MAP[categoryRow.icon] : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ArticleViewTracker articleId={article.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HelpBreadcrumb
          items={[
            { label: KNOWLEDGE_CATEGORY_LABEL[article.category], href: `/dashboard/help/category/${article.category}` },
            { label: article.title },
          ]}
        />
        {canManage && (
          <div className="mb-4 flex items-center gap-2.5">
            <Link
              href={`/dashboard/knowledge/${article.id}?edit=1`}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-extrabold text-muted hover:border-accent-500 hover:text-accent-600"
            >
              تعديل المقال
            </Link>
            <ArticleStatusActions
              articleId={article.id}
              status={article.status}
              canManage={canManage}
              canDelete={profile.role === "super_admin"}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[18px] border border-border bg-surface p-6 sm:p-8">
            <div className="mb-1 flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <h1 className="font-display text-[21px] text-foreground">{article.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-faint">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone.bg} ${tone.fg}`}
                  >
                    {KNOWLEDGE_CATEGORY_LABEL[article.category]}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" /> آخر تحديث: {formatDate(article.updated_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <EyeIcon className="h-3.5 w-3.5" /> {article.view_count} مشاهدة
                  </span>
                </div>
              </div>
              {CategoryIcon && (
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${tone.bg} ${tone.fg}`}>
                  <CategoryIcon className="h-5 w-5" />
                </span>
              )}
            </div>

            <div className="pt-5">
              <ArticleContent content={article.content} />
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <ArticleVoteWidget articleId={article.id} initialVote={myVote} />
            </div>
          </div>

          <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
            <h2 className="text-sm font-extrabold text-foreground">المرفقات</h2>
            <KnowledgeAttachments
              articleId={article.id}
              attachments={attachmentsWithUrls}
              currentUserId={profile.id}
              canDeleteAny={profile.role === "super_admin"}
            />
          </section>
        </div>

        <aside className="space-y-4">
          {article.target_url && (
            <Link
              href={article.target_url}
              className="flex items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-4 py-3 text-[13.5px] font-extrabold text-white transition-colors hover:bg-accent-600"
            >
              الانتقال إلى الصفحة <ExternalLinkIcon className="h-4 w-4" />
            </Link>
          )}

          <div className="rounded-[16px] border border-border bg-surface p-4.5">
            <h3 className="mb-3 text-[12.5px] font-extrabold text-faint">التنقل السريع</h3>
            <div className="flex flex-col gap-1">
              <Link
                href="/dashboard/help"
                className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-bold text-muted hover:bg-background hover:text-foreground"
              >
                <HomeIcon className="h-4 w-4" /> الصفحة الرئيسية
              </Link>
              <Link
                href={`/dashboard/help/category/${article.category}`}
                className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-bold text-muted hover:bg-background hover:text-foreground"
              >
                <FolderIcon className="h-4 w-4" /> {KNOWLEDGE_CATEGORY_LABEL[article.category]}
              </Link>
            </div>
          </div>

          {related.length > 0 && (
            <div className="rounded-[16px] border border-border bg-surface p-4.5">
              <h3 className="mb-3 text-[12.5px] font-extrabold text-faint">مواضيع ذات صلة</h3>
              <div className="flex flex-col gap-1">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/knowledge/${r.id}`}
                    className="rounded-[10px] border-e-2 border-border px-2.5 py-2 text-[12.5px] font-bold text-muted hover:border-accent-500 hover:bg-background hover:text-accent-600"
                  >
                    {r.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {article.keywords.length > 0 && (
            <div className="rounded-[16px] border border-border bg-surface p-4.5">
              <h3 className="mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-faint">
                <TagIcon className="h-3.5 w-3.5" /> كلمات مفتاحية
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {article.keywords.map((kw) => (
                  <span key={kw} className="rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-muted">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
