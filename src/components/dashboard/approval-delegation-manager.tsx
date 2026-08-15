"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createApprovalDelegation,
  cancelApprovalDelegation,
  type DelegationFormState,
} from "@/lib/actions/approval-delegations";

const initialState: DelegationFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500";

type DelegationRow = {
  id: string;
  delegator_id: string;
  delegate_id: string;
  delegator_name: string | null;
  delegate_name: string | null;
  starts_at: string;
  ends_at: string;
};

export function ApprovalDelegationManager({
  delegations,
  currentUserId,
  employees,
}: {
  delegations: DelegationRow[];
  currentUserId: string;
  employees: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createApprovalDelegation, initialState);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const given = delegations.filter((d) => d.delegator_id === currentUserId);
  const received = delegations.filter((d) => d.delegate_id === currentUserId);

  async function handleCancel(id: string) {
    setCancellingId(id);
    await cancelApprovalDelegation(id);
    setCancellingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-extrabold text-foreground">تفويض الموافقات</h2>
      <p className="mb-3 text-[12px] text-muted">
        فوّض صلاحية الموافقة على الطلبات التي تخصّك لشخص آخر خلال فترة غيابك.
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">فوّض إلى</span>
          <select name="delegate_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>اختر موظفًا</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">من</span>
          <input type="date" name="starts_at" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">إلى</span>
          <input type="date" name="ends_at" required className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإنشاء..." : "تفويض"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-[12px] text-red-600">{state.error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-[12px] font-bold text-faint">تفويضات منحتها</h3>
          {given.length === 0 && <p className="text-[12px] text-muted">لا شيء</p>}
          <ul className="space-y-1.5">
            {given.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5 text-[12px]">
                <span>
                  {d.delegate_name ?? "—"} ({new Date(d.starts_at).toLocaleDateString("ar")} - {new Date(d.ends_at).toLocaleDateString("ar")})
                </span>
                <button
                  type="button"
                  disabled={cancellingId === d.id}
                  onClick={() => handleCancel(d.id)}
                  className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-60"
                >
                  إلغاء
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-[12px] font-bold text-faint">تفويضات مُنحت لك</h3>
          {received.length === 0 && <p className="text-[12px] text-muted">لا شيء</p>}
          <ul className="space-y-1.5">
            {received.map((d) => (
              <li key={d.id} className="rounded-md bg-background px-2.5 py-1.5 text-[12px]">
                من {d.delegator_name ?? "—"} ({new Date(d.starts_at).toLocaleDateString("ar")} - {new Date(d.ends_at).toLocaleDateString("ar")})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
