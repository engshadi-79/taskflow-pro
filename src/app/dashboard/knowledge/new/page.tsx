import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/components/dashboard/article-form";

export default async function NewArticlePage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard/knowledge");
  }

  const supabase = await createClient();
  const [{ data: departments }, { data: projects }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">مقال جديد</h1>
      <ArticleForm departments={departments ?? []} projects={projects ?? []} />
    </div>
  );
}
