"use client";

import { useActionState, useState } from "react";
import {
  createSlaPolicy,
  updateSlaPolicy,
  toggleSlaPolicyActive,
  deleteSlaPolicy,
  type SlaFormState,
} from "@/lib/actions/sla";
import { PageHeader } from "@/components/shared/page-header";
import { ClockIcon } from "@/components/shared/icons";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";
import type { SlaPolicy } from "@/lib/types/sla";

const initialState: SlaFormState = {};
const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function SlaPoliciesManager({ policies }: { policies: SlaPolicy[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createState, createAction, creating] = useActionState(createSlaPolicy, initialState);

  return (
    <div className="space-y-6">
      <PageHeader
        title="سياسات SLA"
        subtitle="وقت الاستجابة والإنجاز المتفق عليه لكل أولوية"
        variant="navy"
        icon={<ClockIcon className="h-6 w-6" />}
        count={`${policies.length} سياسة`}
      />

      <form
        action={createAction}
        className="flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">اسم السياسة</span>
          <input name="name" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" defaultValue="medium" className={inputClass}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">وقت الاستجابة (دقيقة)</span>
          <input type="number" name="response_minutes" min="1" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">وقت الإنجاز (دقيقة)</span>
          <input type="number" name="resolution_minutes" min="1" required className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {creating ? "جارٍ الإضافة..." : "إضافة سياسة"}
        </button>
        {createState?.error && <p className="text-sm text-red-600">{createState.error}</p>}
      </form>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs font-medium text-muted">
            <tr>
              <th className="px-4 py-3 text-start">السياسة</th>
              <th className="px-4 py-3 text-start">الأولوية</th>
              <th className="px-4 py-3 text-start">الاستجابة</th>
              <th className="px-4 py-3 text-start">الإنجاز</th>
              <th className="px-4 py-3 text-start">الحالة</th>
              <th className="px-4 py-3 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <PolicyRow
                key={policy.id}
                policy={policy}
                isEditing={editingId === policy.id}
                onEdit={() => setEditingId(policy.id)}
                onCancel={() => setEditingId(null)}
              />
            ))}
            {policies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  لا توجد سياسات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PolicyRow({
  policy,
  isEditing,
  onEdit,
  onCancel,
}: {
  policy: SlaPolicy;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateSlaPolicy, initialState);
  const [busy, setBusy] = useState(false);

  if (isEditing) {
    return (
      <tr className="border-t border-border">
        <td colSpan={6} className="px-4 py-3">
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={policy.id} />
            <input name="name" defaultValue={policy.name} required className={inputClass} />
            <input
              type="number"
              name="response_minutes"
              min="1"
              defaultValue={policy.response_minutes}
              required
              className={inputClass}
            />
            <input
              type="number"
              name="resolution_minutes"
              min="1"
              defaultValue={policy.resolution_minutes}
              required
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent-50"
            >
              إلغاء
            </button>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 text-foreground">{policy.name}</td>
      <td className="px-4 py-3 text-muted">{PRIORITY_LABEL[policy.priority]}</td>
      <td className="px-4 py-3 text-muted">{policy.response_minutes} د</td>
      <td className="px-4 py-3 text-muted">{policy.resolution_minutes} د</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await toggleSlaPolicyActive(policy.id, !policy.is_active);
            setBusy(false);
          }}
          className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${
            policy.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"
          }`}
        >
          {policy.is_active ? "نشطة" : "معطّلة"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="text-sm text-accent-600 hover:underline">
            تعديل
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("حذف هذه السياسة؟")) return;
              setBusy(true);
              await deleteSlaPolicy(policy.id);
              setBusy(false);
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}
