import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { getRelatedArticles } from "@/lib/data/help-center";
import { ArticleForm } from "@/components/dashboard/article-form";
import { ArticleStatusActions } from "@/components/dashboard/article-status-actions";
import { KnowledgeAttachments } from "@/components/dashboard/knowledge-attachments";
import { HelpBreadcrumb } from "@/components/dashboard/help-breadcrumb";
import { HelpArticleRow } from "@/components/dashboard/help-article-row";
import { ArticleVoteWidget } from "@/components/dashboard/article-vote-widget";
import { ArticleViewTracker } from "@/components/dashboard/article-view-tracker";
import { TagIcon } from "@/components/shared/icons";
import { KNOWLEDGE_CATEGORY_LABEL, type KnowledgeArticle, type KnowledgeCategoryRow } from "@/lib/types/knowledge";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // the reading-experience extras (breadcrumb target, related articles,
  // keyword tags, vote widget) only apply to the non-manager read view below -
  // a manager lands straight into ArticleForm and never sees them
  let categoryRow: KnowledgeCategoryRow | null = null;
  let related: KnowledgeArticle[] = [];
  let myVote: "up" | "down" | null = null;
  if (!canManage) {
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

  return (
    <div className="max-w-3xl space-y-6">
      {!canManage && (
        <HelpBreadcrumb
          items={[
            { label: KNOWLEDGE_CATEGORY_LABEL[article.category], href: `/dashboard/help/category/${article.category}` },
            { label: article.title },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/knowledge" className="text-[12.5px] font-bold text-accent-600 hover:underline">
            ← قاعدة المعرفة
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

      {canManage ? (
        <ArticleForm article={article} departments={departments ?? []} projects={projects ?? []} />
      ) : (
        <>
          <ArticleViewTracker articleId={article.id} />
          <div className="space-y-5 rounded-[18px] border border-border bg-surface p-6 text-sm text-foreground">
            <p className="whitespace-pre-wrap">{article.content || "لا يوجد محتوى"}</p>

            {article.keywords.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
                <TagIcon className="h-3.5 w-3.5 text-faint" />
                {article.keywords.map((kw) => (
                  <span key={kw} className="rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-muted">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            <ArticleVoteWidget articleId={article.id} initialVote={myVote} />
          </div>

          {related.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-foreground">مواضيع ذات صلة</h2>
              <div className="flex flex-col gap-2.5">
                {related.map((r) => (
                  <HelpArticleRow key={r.id} article={r} category={categoryRow ?? undefined} showCategory={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

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
