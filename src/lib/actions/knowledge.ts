"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { KnowledgeCategory, KnowledgeStatus } from "@/lib/types/knowledge";

export type KnowledgeFormState = { error?: string };

const MANAGE_ROLES = ["super_admin", "department_manager"];
const VALID_CATEGORIES: KnowledgeCategory[] = [
  "policy",
  "procedure",
  "form",
  "guide",
  "instruction",
  "decision",
];

export async function createArticle(
  _prevState: KnowledgeFormState,
  formData: FormData
): Promise<KnowledgeFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بإنشاء مقالات" };
  }

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || "";
  const category = formData.get("category") as KnowledgeCategory;
  const departmentId = (formData.get("department_id") as string) || null;
  const projectId = (formData.get("project_id") as string) || null;

  if (!title) return { error: "عنوان المقال مطلوب" };
  if (!VALID_CATEGORIES.includes(category)) return { error: "تصنيف غير صالح" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_articles")
    .insert({
      organization_id: profile.organization_id,
      title,
      content,
      category,
      department_id: departmentId,
      project_id: projectId,
      author_id: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "تعذر إنشاء المقال" };

  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${data.id}`);
}

export async function updateArticle(
  _prevState: KnowledgeFormState,
  formData: FormData
): Promise<KnowledgeFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || "";
  const category = formData.get("category") as KnowledgeCategory;
  const departmentId = (formData.get("department_id") as string) || null;
  const projectId = (formData.get("project_id") as string) || null;

  if (!title) return { error: "عنوان المقال مطلوب" };
  if (!VALID_CATEGORIES.includes(category)) return { error: "تصنيف غير صالح" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("knowledge_articles")
    .update({ title, content, category, department_id: departmentId, project_id: projectId })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث المقال" };

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${id}`);
  return {};
}

export async function setArticleStatus(id: string, status: KnowledgeStatus): Promise<KnowledgeFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("knowledge_articles").update({ status }).eq("id", id);

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${id}`);
  return error ? { error: "تعذر تحديث حالة المقال" } : {};
}

export async function deleteArticle(id: string): Promise<KnowledgeFormState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بحذف المقالات" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("knowledge_articles").delete().eq("id", id);

  revalidatePath("/dashboard/knowledge");
  return error ? { error: "تعذر حذف المقال" } : {};
}

export async function uploadKnowledgeAttachment(
  _prevState: KnowledgeFormState,
  formData: FormData
): Promise<KnowledgeFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const articleId = formData.get("article_id") as string;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "اختر ملفًا للرفع" };

  const supabase = await createClient();
  const path = `knowledge/${articleId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("task-attachments").upload(path, file);
  if (uploadError) return { error: "تعذر رفع الملف" };

  const { error: insertError } = await supabase.from("knowledge_attachments").insert({
    article_id: articleId,
    uploaded_by: profile.id,
    file_url: path,
    file_name: file.name,
    file_type: file.type || null,
  });

  if (insertError) {
    await supabase.storage.from("task-attachments").remove([path]);
    return { error: "تعذر حفظ بيانات المرفق" };
  }

  revalidatePath(`/dashboard/knowledge/${articleId}`);
  return {};
}

export async function deleteKnowledgeAttachment(id: string, articleId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("task-attachments").remove([filePath]);
  await supabase.from("knowledge_attachments").delete().eq("id", id);
  revalidatePath(`/dashboard/knowledge/${articleId}`);
}
