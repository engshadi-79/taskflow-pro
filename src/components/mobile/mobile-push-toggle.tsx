"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/lib/actions/push-subscriptions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "unsupported" | "checking" | "off" | "on";

export function MobilePushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    });
  }, []);

  async function enable() {
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("لم يتم منح إذن الإشعارات");
        setPending(false);
        return;
      }
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const result = await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (result?.error) {
        setError(result.error);
        await subscription.unsubscribe();
        setPending(false);
        return;
      }
      setStatus("on");
    } catch {
      setError("تعذر تفعيل الإشعارات على هذا الجهاز");
    }
    setPending(false);
  }

  async function disable() {
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("تعذر إلغاء تفعيل الإشعارات");
    }
    setPending(false);
  }

  if (status === "unsupported") return null;

  const on = status === "on";

  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.05)]">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent-50 text-accent-600">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 3.2 1.4 5 1.4 5H5.1s1.4-1.8 1.4-5Z" />
          <path d="M9.8 17.5a2.4 2.4 0 0 0 4.4 0" />
        </svg>
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-foreground">تنبيهات فورية على الجوال</div>
        <div className="mt-0.5 text-[11px] font-semibold text-faint">تصلك حتى لو التطبيق مقفول</div>
        {error && <div className="mt-1 text-[11px] font-semibold text-brand-red-600">{error}</div>}
      </div>
      <button
        type="button"
        disabled={pending || status === "checking"}
        onClick={() => (on ? disable() : enable())}
        aria-pressed={on}
        className="relative h-[23px] w-10 shrink-0 rounded-full disabled:opacity-60"
        style={{ background: on ? "#4f46e5" : "#e2e8f0" }}
      >
        <span
          className="absolute top-0.5 h-[19px] w-[19px] rounded-full bg-white transition-all"
          style={{ [on ? "right" : "left"]: "2px" } as React.CSSProperties}
        />
      </button>
    </div>
  );
}
