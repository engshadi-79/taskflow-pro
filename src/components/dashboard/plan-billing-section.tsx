"use client";

import { useActionState, useState } from "react";
import { requestPlanUpgrade, type PlanUpgradeState } from "@/lib/actions/plans";
import { PLAN_LABEL, PAYMENT_METHOD_LABEL, seatLimitFor, type PaymentMethod } from "@/lib/plans";
import type { Organization } from "@/lib/types/organization";

const initialState: PlanUpgradeState = {};

export function PlanBillingSection({
  organization,
  seatCount,
  hasPendingRequest,
  paymentMethods,
}: {
  organization: Organization;
  seatCount: number;
  hasPendingRequest: boolean;
  paymentMethods: Partial<Record<PaymentMethod, string>>;
}) {
  const [state, formAction, pending] = useActionState(requestPlanUpgrade, initialState);
  const limit = seatLimitFor(organization.plan_type);
  const methodEntries = Object.entries(paymentMethods) as [PaymentMethod, string][];
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    methodEntries.length > 0 ? methodEntries[0][0] : null
  );

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
      ) : methodEntries.length === 0 ? (
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
      ) : (
        <form action={formAction} className="space-y-2.5">
          <p className="text-[12px] text-muted">
            حوّل المبلغ المتفق عليه مع فريقنا عبر إحدى الطريقتين، ثم أدخل رقم/مرجع التحويل هنا ليتم تفعيل الخطة بعد
            التأكد منه.
          </p>

          <div className="flex gap-2">
            {methodEntries.map(([method]) => (
              <button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={`flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-extrabold transition-colors ${
                  selectedMethod === method
                    ? "border-accent-500 bg-accent-50 text-accent-700"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {PAYMENT_METHOD_LABEL[method]}
              </button>
            ))}
          </div>

          {selectedMethod && (
            <>
              <input type="hidden" name="payment_method" value={selectedMethod} />
              <p className="whitespace-pre-line rounded-[10px] bg-background p-3 text-[12.5px] text-foreground">
                {paymentMethods[selectedMethod]}
              </p>
              <input
                name="payment_reference"
                required
                placeholder="رقم/مرجع التحويل"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </>
          )}

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
            {pending ? "جارٍ الإرسال..." : "إرسال إثبات الدفع"}
          </button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
