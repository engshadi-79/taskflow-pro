"use client";

import { useActionState, useState } from "react";
import {
  assignTrackResponsible,
  createInventoryTool,
  updateInventoryTool,
  deleteInventoryTool,
  type InventoryFormState,
} from "@/lib/actions/inventory";
import type { InventoryTool, InventoryTrack } from "@/lib/types/inventory";

type EmployeeOption = { id: string; full_name: string };
type TrackWithResponsible = InventoryTrack & { responsible: { id: string; full_name: string } | null };

const initialState: InventoryFormState = {};
const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500";

export function InventoryToolsManager({
  track,
  tools,
  employees,
}: {
  track: TrackWithResponsible;
  tools: InventoryTool[];
  employees: EmployeeOption[];
}) {
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createState, createAction, creating] = useActionState(createInventoryTool, initialState);

  async function handleAssign(userId: string) {
    setAssigning(true);
    setAssignError(null);
    const result = await assignTrackResponsible(track.id, userId || null);
    setAssigning(false);
    if (result?.error) setAssignError(result.error);
  }

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14.5px] font-extrabold text-foreground">إدارة مسار {track.name}</h3>
          <p className="mt-0.5 text-[12px] text-muted">تحديد الموظف المسؤول وقائمة الأدوات الثابتة</p>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold text-muted">المسؤول</span>
          <select
            defaultValue={track.responsible_user_id ?? ""}
            disabled={assigning}
            onChange={(e) => handleAssign(e.target.value)}
            className={inputClass}
          >
            <option value="">بدون مسؤول</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {assignError && <p className="mb-3 text-[12px] text-red-600">{assignError}</p>}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[12.5px] font-bold text-accent-600 hover:underline"
      >
        {expanded ? "إخفاء إدارة الأدوات" : "إدارة قائمة الأدوات"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <form action={createAction} className="flex flex-wrap items-end gap-2.5 rounded-[14px] border border-border bg-background p-3.5">
            <input type="hidden" name="track_id" value={track.id} />
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted">اسم الأداة</span>
              <input name="name" required className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted">الوحدة (اختياري)</span>
              <input name="unit" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted">الكمية الكلية</span>
              <input name="total_quantity" className={inputClass} />
            </label>
            <button
              type="submit"
              disabled={creating}
              className="rounded-[10px] bg-accent-500 px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {creating ? "جارٍ الإضافة..." : "إضافة أداة"}
            </button>
            {createState?.error && <p className="text-[12px] text-red-600">{createState.error}</p>}
          </form>

          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs font-medium text-muted">
                <tr>
                  <th className="px-3 py-2 text-start">الأداة</th>
                  <th className="px-3 py-2 text-start">الوحدة</th>
                  <th className="px-3 py-2 text-start">الكمية الكلية</th>
                  <th className="px-3 py-2 text-start">إجراءات</th>
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
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      لا توجد أدوات بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
      <tr className="border-t border-border">
        <td colSpan={4} className="px-3 py-3">
          <form action={formAction} className="flex flex-wrap items-end gap-2.5">
            <input type="hidden" name="id" value={tool.id} />
            <input name="name" defaultValue={tool.name} required className={inputClass} />
            <input name="unit" defaultValue={tool.unit ?? ""} className={inputClass} />
            <input name="total_quantity" defaultValue={tool.total_quantity ?? ""} className={inputClass} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-accent-50"
            >
              إلغاء
            </button>
            {state?.error && <p className="text-[12px] text-red-600">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border transition-colors hover:bg-background">
      <td className="px-3 py-2.5 text-foreground">{tool.name}</td>
      <td className="px-3 py-2.5 text-muted">{tool.unit ?? "—"}</td>
      <td className="px-3 py-2.5 text-muted">{tool.total_quantity ?? "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="text-[12.5px] font-bold text-accent-600 hover:underline">
            تعديل
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("حذف هذه الأداة؟")) return;
              setBusy(true);
              await deleteInventoryTool(tool.id);
              setBusy(false);
            }}
            className="text-[12.5px] font-bold text-red-600 hover:underline disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}
