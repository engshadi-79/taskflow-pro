"use client";

import { useActionState } from "react";
import { createArticle, updateArticle, type KnowledgeFormState } from "@/lib/actions/knowledge";
import { KNOWLEDGE_CATEGORY_LABEL, type KnowledgeArticle, type KnowledgeCategory } from "@/lib/types/knowledge";

const initialState: KnowledgeFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type DepartmentOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };

export function ArticleForm({
  article,
  departments,
  projects,
}: {
  article?: KnowledgeArticle;
  departments: DepartmentOption[];
  projects: ProjectOption[];
}) {
  const action = article ? updateArticle : createArticle;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      {article && <input type="hidden" name="id" value={article.id} />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">العنوان</span>
        <input name="title" defaultValue={article?.title} required className={inputClass} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">التصنيف</span>
          <select name="category" defaultValue={article?.category ?? "guide"} className={inputClass}>
            {(Object.keys(KNOWLEDGE_CATEGORY_LABEL) as KnowledgeCategory[]).map((c) => (
              <option key={c} value={c}>
                {KNOWLEDGE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">القسم (اختياري)</span>
          <select name="department_id" defaultValue={article?.department_id ?? ""} className={inputClass}>
            <option value="">بدون قسم</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المشروع (اختياري)</span>
          <select name="project_id" defaultValue={article?.project_id ?? ""} className={inputClass}>
            <option value="">بدون مشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">المحتوى</span>
        <textarea name="content" defaultValue={article?.content} rows={10} className={inputClass} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : article ? "حفظ التعديلات" : "إنشاء المقال (كمسودة)"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
