"use client";

import { useActionState, useState } from "react";
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  revokeApiKey,
  toggleWebhookEndpoint,
  type DeveloperState,
} from "@/lib/actions/developer";
import { EVENT_LABEL, WEBHOOK_EVENTS, type ApiKey, type WebhookDelivery, type WebhookEndpoint } from "@/lib/types/developer";

const initialState: DeveloperState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function DeveloperSettingsManager({
  apiKeys,
  endpoints,
  deliveries,
}: {
  apiKeys: ApiKey[];
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
}) {
  return (
    <div className="space-y-4.5">
      <ApiKeysSection apiKeys={apiKeys} />
      <WebhooksSection endpoints={endpoints} deliveries={deliveries} />
    </div>
  );
}

function ApiKeysSection({ apiKeys }: { apiKeys: ApiKey[] }) {
  const [state, formAction, pending] = useActionState(createApiKey, initialState);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <h2 className="mb-1 text-sm font-extrabold text-foreground">مفاتيح API</h2>
      <p className="mb-4 text-[12.5px] text-muted">
        استخدم مفتاحًا في ترويسة <code dir="ltr">Authorization: Bearer &lt;key&gt;</code> للوصول إلى{" "}
        <code dir="ltr">/api/v1/tasks</code> من أنظمتك الخارجية.
      </p>

      {state.plaintext && (
        <div className="mb-4 rounded-[10px] border border-accent-300 bg-accent-50 p-3.5">
          <p className="mb-1.5 text-[12px] font-bold text-accent-700">
            انسخ هذا المفتاح الآن — لن يظهر مرة أخرى
          </p>
          <code dir="ltr" className="block break-all rounded bg-white px-2.5 py-2 text-[12.5px] text-foreground">
            {state.plaintext}
          </code>
        </div>
      )}

      <form action={formAction} className="mb-4 flex flex-wrap gap-2.5">
        <input name="name" placeholder="اسم المفتاح (مثال: تكامل ERP)" required className={`${inputClass} flex-1`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإنشاء..." : "إنشاء مفتاح"}
        </button>
      </form>
      {state.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}

      <div className="space-y-2">
        {apiKeys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-foreground">{k.name}</p>
              <p className="text-[11.5px] text-muted">
                <code dir="ltr">{k.key_prefix}…</code>
                {k.last_used_at ? ` · آخر استخدام ${new Date(k.last_used_at).toLocaleDateString("ar")}` : " · لم يُستخدَم بعد"}
              </p>
            </div>
            {k.revoked_at ? (
              <span className="shrink-0 text-[12px] font-bold text-muted">مُلغى</span>
            ) : (
              <button
                type="button"
                disabled={busyId === k.id}
                onClick={async () => {
                  if (!confirm("إلغاء هذا المفتاح؟ لن يعمل بعد الآن.")) return;
                  setBusyId(k.id);
                  await revokeApiKey(k.id);
                  setBusyId(null);
                }}
                className="shrink-0 text-[12px] font-bold text-red-600 hover:underline disabled:opacity-60"
              >
                إلغاء
              </button>
            )}
          </div>
        ))}
        {apiKeys.length === 0 && <p className="text-[12.5px] text-muted">لا توجد مفاتيح بعد</p>}
      </div>
    </div>
  );
}

function WebhooksSection({ endpoints, deliveries }: { endpoints: WebhookEndpoint[]; deliveries: WebhookDelivery[] }) {
  const [state, formAction, pending] = useActionState(createWebhookEndpoint, initialState);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <h2 className="mb-1 text-sm font-extrabold text-foreground">وجهات Webhook</h2>
      <p className="mb-4 text-[12.5px] text-muted">
        عند وقوع الحدث، يُرسَل طلب POST موقَّع (HMAC-SHA256، ترويسة{" "}
        <code dir="ltr">X-Monjez-Signature</code>) فورًا إلى الرابط — محاولة واحدة، بلا إعادة محاولة تلقائية.
      </p>

      {state.secret && (
        <div className="mb-4 rounded-[10px] border border-accent-300 bg-accent-50 p-3.5">
          <p className="mb-1.5 text-[12px] font-bold text-accent-700">
            انسخ مفتاح التوقيع هذا الآن — لن يظهر مرة أخرى
          </p>
          <code dir="ltr" className="block break-all rounded bg-white px-2.5 py-2 text-[12.5px] text-foreground">
            {state.secret}
          </code>
        </div>
      )}

      <form action={formAction} className="mb-4 space-y-2.5">
        <input name="url" type="url" placeholder="https://example.com/webhooks/monjez" required className={inputClass} />
        <div className="flex flex-wrap gap-3">
          {WEBHOOK_EVENTS.map((evt) => (
            <label key={evt} className="flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
              <input type="checkbox" name="events" value={evt} className="h-4 w-4 accent-accent-600" />
              {EVENT_LABEL[evt]}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإضافة..." : "إضافة وجهة"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

      <div className="mb-4 space-y-2">
        {endpoints.map((e) => (
          <div key={e.id} className="rounded-[10px] border border-border px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <code dir="ltr" className="truncate text-[12.5px] text-foreground">{e.url}</code>
              <div className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  disabled={busyId === e.id}
                  onClick={async () => {
                    setBusyId(e.id);
                    await toggleWebhookEndpoint(e.id, !e.is_active);
                    setBusyId(null);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${
                    e.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"
                  }`}
                >
                  {e.is_active ? "نشطة" : "معطّلة"}
                </button>
                <button
                  type="button"
                  disabled={busyId === e.id}
                  onClick={async () => {
                    if (!confirm("حذف هذه الوجهة؟")) return;
                    setBusyId(e.id);
                    await deleteWebhookEndpoint(e.id);
                    setBusyId(null);
                  }}
                  className="text-[12px] font-bold text-red-600 hover:underline disabled:opacity-60"
                >
                  حذف
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {e.events.map((evt) => EVENT_LABEL[evt] ?? evt).join(" · ")}
            </p>
          </div>
        ))}
        {endpoints.length === 0 && <p className="text-[12.5px] text-muted">لا توجد وجهات بعد</p>}
      </div>

      {deliveries.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12.5px] font-extrabold text-foreground">آخر المحاولات</h3>
          <div className="max-h-[220px] space-y-1.5 overflow-y-auto">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-muted">{EVENT_LABEL[d.event_type] ?? d.event_type}</span>
                <span className={d.status === "delivered" ? "font-bold text-green-600" : "font-bold text-red-600"}>
                  {d.status === "delivered" ? `نجح (${d.response_status})` : `فشل${d.error ? `: ${d.error}` : ""}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
