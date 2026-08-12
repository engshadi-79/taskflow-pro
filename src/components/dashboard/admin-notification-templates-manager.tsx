"use client";

import { useState } from "react";
import {
  createAdminNotificationTemplate,
  updateAdminNotificationTemplate,
  deleteAdminNotificationTemplate,
} from "@/lib/actions/admin-notification-templates";
import { CloseIcon, PlusIcon } from "@/components/shared/icons";

type Template = {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  created_by: string | null;
};

const TYPE_OPTIONS = [
  { value: "general", label: "عام" },
  { value: "announcement", label: "تعميم" },
  { value: "reminder", label: "تذكير" },
  { value: "warning", label: "تنبيه" },
  { value: "urgent", label: "عاجل" },
  { value: "meeting", label: "اجتماع" },
  { value: "system", label: "نظام" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

function emptyDraft() {
  return { name: "", title: "", message: "", type: "general", priority: "normal" };
}

export function AdminNotificationTemplatesManager({
  templates,
  currentUserId,
  canManageAll,
}: {
  templates: Template[];
  currentUserId: string;
  canManageAll: boolean;
}) {
  const [items, setItems] = useState(templates);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("name", draft.name);
    fd.set("title", draft.title);
    fd.set("message", draft.message);
    fd.set("type", draft.type);
    fd.set("priority", draft.priority);
    const result = await createAdminNotificationTemplate({}, fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => [
      { id: crypto.randomUUID(), created_by: currentUserId, ...draft },
      ...prev,
    ]);
    setDraft(emptyDraft());
    setCreating(false);
  }

  async function handleUpdate(id: string) {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("name", editDraft.name);
    fd.set("title", editDraft.title);
    fd.set("message", editDraft.message);
    fd.set("type", editDraft.type);
    fd.set("priority", editDraft.priority);
    const result = await updateAdminNotificationTemplate(id, {}, fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...editDraft } : t)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteAdminNotificationTemplate(id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  function canEdit(t: Template) {
    return canManageAll || t.created_by === currentUserId;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-extrabold text-white hover:bg-accent-600"
        >
          <PlusIcon className="h-4 w-4" />
          قالب جديد
        </button>
      ) : (
        <div className="space-y-3 rounded-[14px] border border-border bg-surface p-4">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="اسم القالب"
            maxLength={60}
            className={inputClass}
          />
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="عنوان الإشعار"
            maxLength={120}
            className={inputClass}
          />
          <textarea
            value={draft.message}
            onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
            placeholder="نص الرسالة"
            rows={3}
            maxLength={2000}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-3">
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className={`${inputClass} sm:w-1/2`}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} className={`${inputClass} sm:w-1/2`}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleCreate}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              حفظ القالب
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDraft(emptyDraft());
              }}
              className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-foreground hover:bg-background"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="space-y-2 rounded-[14px] border border-accent-300 bg-accent-50 p-4">
              <input
                value={editDraft.name}
                onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={60}
                className={inputClass}
              />
              <input
                value={editDraft.title}
                onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                maxLength={120}
                className={inputClass}
              />
              <textarea
                value={editDraft.message}
                onChange={(e) => setEditDraft((d) => ({ ...d, message: e.target.value }))}
                rows={3}
                maxLength={2000}
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                <select value={editDraft.type} onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))} className={`${inputClass} sm:w-1/2`}>
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select value={editDraft.priority} onChange={(e) => setEditDraft((d) => ({ ...d, priority: e.target.value }))} className={`${inputClass} sm:w-1/2`}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleUpdate(t.id)}
                  className="rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-foreground hover:bg-background"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="relative rounded-[14px] border border-border bg-surface p-4">
              {canEdit(t) && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  aria-label="حذف القالب"
                  className="absolute end-3 top-3 rounded-full p-1 text-faint hover:bg-background hover:text-red-600"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <p className="mb-1 pe-6 text-[13.5px] font-extrabold text-foreground">{t.name}</p>
              <p className="mb-1 text-[12.5px] font-bold text-muted">{t.title}</p>
              <p className="line-clamp-2 text-[12.5px] text-faint">{t.message}</p>
              {canEdit(t) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditDraft({ name: t.name, title: t.title, message: t.message, type: t.type, priority: t.priority });
                  }}
                  className="mt-2 text-[11.5px] font-bold text-accent-600 hover:underline"
                >
                  تعديل
                </button>
              )}
            </div>
          )
        )}
        {items.length === 0 && <p className="text-sm text-muted">لا توجد قوالب بعد</p>}
      </div>
    </div>
  );
}
