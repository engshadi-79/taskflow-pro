export type KnowledgeCategory = "policy" | "procedure" | "form" | "guide" | "instruction" | "decision";
export type KnowledgeStatus = "draft" | "published" | "archived";

export type KnowledgeArticle = {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  department_id: string | null;
  project_id: string | null;
  task_id: string | null;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeAttachment = {
  id: string;
  article_id: string;
  uploaded_by: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_at: string;
};

export const KNOWLEDGE_CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  policy: "سياسات",
  procedure: "إجراءات",
  form: "نماذج",
  guide: "أدلة",
  instruction: "تعليمات",
  decision: "قرارات",
};

export const KNOWLEDGE_STATUS_LABEL: Record<KnowledgeStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};
