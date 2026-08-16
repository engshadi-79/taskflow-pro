"use client";

import { useActionState } from "react";
import { requestPlanUpgrade, type PlanUpgradeState } from "@/lib/actions/plans";
import { PLAN_LABEL, seatLimitFor } from "@/lib/plans";
import type { Organization } from "@/lib/types/organization";

const initialState: PlanUpgradeState = {};

export function PlanBillingSection({
  organization,
  seatCount,
  hasPendingRequest,
}: {
  organization: Organization;
  seatCount: number;
  hasPendingRequest: boolean;
}) {
  const [state, formAction, pending] = useActionState(requestPlanUpgrade, initialState);
  const limit = seatLimitFor(organization.plan_type);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <h2 className="mb-1 text-sm font-extrabold text-foreground">الخطة والفوترة</h2>
      <p className="mb-4 text-[12.5px] text-muted">خطتك الحالية واستخدام المقاعد</p>

      <div className="mb-4 flex items-center justify-between rounded-[12px] bg-background p-4">
        <div>
          <span className="block text-[12px] font-medium text-muted">الخطة الحالية</span>
          <span className="block text-[15px] font-extrabold text-foreground">
            {PLAN_LABEL[organization.plan_type]}
          </span>
        </div>
        <div className="text-end">
          <span className="block text-[12px] font-medium text-muted">الموظفون النشطون</span>
          <span className="block text-[15px] font-extrabold text-foreground">
            {seatCount}
            {limit !== null ? ` / ${limit}` : ""}
          </span>
        </div>
      </div>

      {organization.plan_type === "paid" ? (
        <p className="text-[12.5px] text-muted">أنت على الخطة المدفوعة — لا حد لعدد الموظفين.</p>
      ) : state.success || hasPendingRequest ? (
        <p className="rounded-[10px] bg-green-50 px-3.5 py-3 text-[12.5px] font-bold text-green-700">
          تم إرسال طلب الترقية، سيتواصل معك فريق الدعم لإكمالها.
        </p>
      ) : (
        <form action={formAction} className="space-y-2.5">
          <textarea
            name="note"
            rows={2}
            placeholder="أي تفاصيل إضافية (اختياري)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? "جارٍ الإرسال..." : "طلب الترقية إلى الخطة المدفوعة"}
          </button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
