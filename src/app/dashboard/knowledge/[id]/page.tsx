import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/components/dashboard/article-form";
import { ArticleStatusActions } from "@/components/dashboard/article-status-actions";
import { KnowledgeAttachments } from "@/components/dashboard/knowledge-attachments";
import { KNOWLEDGE_CATEGORY_LABEL, type KnowledgeArticle } from "@/lib/types/knowledge";

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

  return (
    <div className="max-w-3xl space-y-6">
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
        <div className="rounded-[18px] border border-border bg-surface p-6 text-sm text-foreground">
          <p className="whitespace-pre-wrap">{article.content || "لا يوجد محتوى"}</p>
        </div>
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
