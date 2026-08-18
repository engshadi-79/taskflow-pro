"use client";

import { useActionState, useState } from "react";
import {
  createInventoryTool,
  updateInventoryTool,
  deleteInventoryTool,
  type InventoryFormState,
} from "@/lib/actions/inventory";
import type { InventoryTool } from "@/lib/types/inventory";

const initialState: InventoryFormState = {};
const inputClass =
  "rounded-lg border border-[var(--inv-line,#e4e0d2)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink,#1c2b23)] outline-none focus:border-[var(--inv-emerald-700)]";

/** super_admin-only: add/edit/remove the fixed tool list itself - shown
 * only in "إدارة المواد" mode, never mixed with the daily check grid. */
export function InventoryToolsManager({ trackId, tools }: { trackId: string; tools: InventoryTool[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createState, createAction, creating] = useActionState(createInventoryTool, initialState);

  return (
    <div className="space-y-3">
      <form
        action={createAction}
        className="grid grid-cols-1 gap-2.5 rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-4 sm:grid-cols-5 sm:items-end"
      >
        <input type="hidden" name="track_id" value={trackId} />
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11.5px] font-medium text-[var(--muted,#6c7a70)]">اسم المادة *</span>
          <input name="name" required placeholder="مثال: مقص تصفيف" className={`${inputClass} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-[var(--muted,#6c7a70)]">الكمية الكلية</span>
          <input name="total_quantity" placeholder="مثال: 5" className={`${inputClass} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-[var(--muted,#6c7a70)]">الوحدة</span>
          <input name="unit" placeholder="دستة / لفة…" className={`${inputClass} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-[var(--muted,#6c7a70)]">التصنيف</span>
          <input name="group_label" placeholder="اسم الماكينة مثلًا" className={`${inputClass} w-full`} />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-[var(--inv-gold)] px-4 py-2 text-[13px] font-extrabold text-[var(--inv-emerald-950)] hover:bg-[var(--inv-gold-light)] disabled:opacity-60 sm:col-span-5 sm:w-fit"
        >
          {creating ? "جارٍ الإضافة..." : "+ إضافة"}
        </button>
        {createState?.error && <p className="text-[12px] text-[var(--inv-bad)] sm:col-span-5">{createState.error}</p>}
      </form>

      <div className="overflow-x-auto rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--inv-emerald-900)] text-white">
              <th className="px-3 py-2.5 text-start font-display text-[12px] font-bold">المادة</th>
              <th className="px-3 py-2.5 text-start font-display text-[12px] font-bold">التصنيف</th>
              <th className="px-3 py-2.5 text-start font-display text-[12px] font-bold">الكمية الكلية</th>
              <th className="px-3 py-2.5 text-start font-display text-[12px] font-bold">الوحدة</th>
              <th className="px-3 py-2.5 text-start font-display text-[12px] font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                isEditing={editingId === tool.id}
                onEdit={() => setEditingId(tool.id)}
                onCancel={() => setEditingId(null)}
              />
            ))}
            {tools.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted,#6c7a70)]">
                  لا مواد بعد — أضف أول مادة من النموذج أعلاه.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolRow({
  tool,
  isEditing,
  onEdit,
  onCancel,
}: {
  tool: InventoryTool;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateInventoryTool, initialState);
  const [busy, setBusy] = useState(false);

  if (isEditing) {
    return (
      <tr className="border-t border-[var(--inv-line,#e4e0d2)]">
        <td colSpan={5} className="px-3 py-3">
          <form action={formAction} className="flex flex-wrap items-end gap-2.5">
            <input type="hidden" name="id" value={tool.id} />
            <input name="name" defaultValue={tool.name} required className={inputClass} />
            <input name="group_label" defaultValue={tool.group_label ?? ""} placeholder="التصنيف" className={inputClass} />
            <input name="total_quantity" defaultValue={tool.total_quantity ?? ""} placeholder="الكمية" className={inputClass} />
            <input name="unit" defaultValue={tool.unit ?? ""} placeholder="الوحدة" className={inputClass} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--inv-emerald-800)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--inv-emerald-900)] disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[var(--inv-line,#e4e0d2)] px-3 py-1.5 text-[12px] text-[var(--ink,#1c2b23)] hover:bg-black/5"
            >
              إلغاء
            </button>
            {state?.error && <p className="text-[12px] text-[var(--inv-bad)]">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[var(--inv-line,#e4e0d2)] transition-colors hover:bg-black/[0.02]">
      <td className="px-3 py-2.5 text-[var(--ink,#1c2b23)]">{tool.name}</td>
      <td className="px-3 py-2.5 text-[var(--muted,#6c7a70)]">{tool.group_label ?? "—"}</td>
      <td className="px-3 py-2.5 text-[var(--muted,#6c7a70)]">{tool.total_quantity ?? "—"}</td>
      <td className="px-3 py-2.5 text-[var(--muted,#6c7a70)]">{tool.unit ?? "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="text-[12.5px] font-bold text-[var(--inv-emerald-800)] hover:underline">
            تعديل
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("حذف هذه المادة نهائيًا من كشف الجرد؟")) return;
              setBusy(true);
              await deleteInventoryTool(tool.id);
              setBusy(false);
            }}
            className="text-[12.5px] font-bold text-[var(--inv-bad)] hover:underline disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}
