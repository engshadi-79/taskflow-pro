"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateOrganizationAsOwner,
  deleteOrganizationAsOwner,
  approvePlanUpgrade,
  type UpdateOrgState,
  type DeleteOrgState,
  type ApprovePlanUpgradeState,
} from "@/lib/actions/platform";
import { PLAN_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/plans";
import type { PlatformOrganizationRow, PendingUpgradeRequest } from "@/lib/data/organization";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

const initialUpdateState: UpdateOrgState = {};
const initialDeleteState: DeleteOrgState = {};
const initialApproveState: ApprovePlanUpgradeState = {};

function PendingUpgradeCell({ organizationId, request }: { organizationId: string; request: PendingUpgradeRequest }) {
  const [state, formAction, pending] = useActionState(approvePlanUpgrade, initialApproveState);

  return (
    <div className="space-y-1.5">
      <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
        يريد الترقية
      </span>
      <p className="text-[11px] text-muted">
        {request.payment_method ? PAYMENT_METHOD_LABEL[request.payment_method] : "بدون طريقة دفع"}
        {request.payment_reference && ` — ${request.payment_reference}`}
      </p>
      <form action={formAction}>
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="request_id" value={request.id} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {pending ? "جارٍ التفعيل..." : "تفعيل الخطة المدفوعة"}
        </button>
      </form>
      {state.error && <p className="text-[11px] font-bold text-red-600">{state.error}</p>}
    </div>
  );
}

function EditRow({ org, onCancel }: { org: PlatformOrganizationRow; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(updateOrganizationAsOwner, initialUpdateState);

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 py-2">
      <input type="hidden" name="org_id" value={org.id} />
      <input name="name" defaultValue={org.name} required className={`${inputClass} w-auto flex-1`} />
      <select name="plan_type" defaultValue={org.plan_type} className={`${inputClass} w-auto`}>
        <option value="free">{PLAN_LABEL.free}</option>
        <option value="paid">{PLAN_LABEL.paid}</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[8px] bg-accent-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "حفظ"}
      </button>
      <button type="button" onClick={onCancel} className="text-[12px] font-bold text-muted hover:underline">
        إلغاء
      </button>
      {state.error && <p className="w-full text-[11.5px] font-bold text-red-600">{state.error}</p>}
    </form>
  );
}

function DeleteRow({ org, onCancel }: { org: PlatformOrganizationRow; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(deleteOrganizationAsOwner, initialDeleteState);
  const [confirmName, setConfirmName] = useState("");

  return (
    <form action={formAction} className="space-y-2 rounded-[10px] border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="org_id" value={org.id} />
      <input type="hidden" name="actual_name" value={org.name} />
      <p className="text-[12.5px] font-bold text-red-700">
        هذا حذف نهائي لمؤسسة «{org.name}» وكل بياناتها (المستخدمون، المهام، المشاريع...) - لا يمكن التراجع عنه.
      </p>
      <p className="text-[11.5px] text-red-700">
        اكتب اسم المؤسسة <span className="font-extrabold">{org.name}</span> بالضبط للتأكيد:
      </p>
      <input
        name="confirm_name"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        className={inputClass}
      />
      {state.error && <p className="text-[11.5px] font-bold text-red-700">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || confirmName.trim() !== org.name}
          className="rounded-[8px] bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "جارٍ الحذف..." : "تأكيد الحذف نهائيًا"}
        </button>
        <button type="button" onClick={onCancel} className="text-[12px] font-bold text-muted hover:underline">
          إلغاء
        </button>
      </div>
    </form>
  );
}

export function PlatformOrganizationsManager({ organizations }: { organizations: PlatformOrganizationRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-[16px] border border-border bg-surface">
      <table className="w-full text-right text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] font-extrabold uppercase tracking-wide text-faint">
            <th className="px-4 py-3">الاسم</th>
            <th className="px-4 py-3">الخطة</th>
            <th className="px-4 py-3">متبقٍ من التجربة</th>
            <th className="px-4 py-3">الأعضاء</th>
            <th className="px-4 py-3">تاريخ التسجيل</th>
            <th className="px-4 py-3">طلب ترقية</th>
            <th className="px-4 py-3">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => (
            <tr key={org.id} className="border-b border-border align-top last:border-0">
              {editingId === org.id || deletingId === org.id ? (
                <td colSpan={7} className="px-4 py-2">
                  {editingId === org.id && <EditRow org={org} onCancel={() => setEditingId(null)} />}
                  {deletingId === org.id && <DeleteRow org={org} onCancel={() => setDeletingId(null)} />}
                </td>
              ) : (
                <>
                  <td className="px-4 py-3 font-bold text-foreground">{org.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        org.plan_type === "paid" ? "bg-green-50 text-green-700" : "bg-background text-muted"
                      }`}
                    >
                      {PLAN_LABEL[org.plan_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {org.trial_days_remaining === null ? (
                      <span className="text-faint">غير محدود</span>
                    ) : org.trial_days_remaining === 0 ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                        انتهت
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          org.trial_days_remaining <= 3 ? "bg-amber-50 text-amber-700" : "bg-background text-muted"
                        }`}
                      >
                        {org.trial_days_remaining} يوم
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{org.member_count}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(org.created_at).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {org.pending_upgrade_request ? (
                      <PendingUpgradeCell organizationId={org.id} request={org.pending_upgrade_request} />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(org.id)}
                      className="text-[12px] font-bold text-accent-600 hover:underline"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(org.id)}
                      className="text-[12px] font-bold text-red-600 hover:underline"
                    >
                      حذف
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {organizations.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted">
                لا توجد مؤسسات مسجّلة بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
