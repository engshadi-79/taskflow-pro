import webpush from "web-push";

// Configured lazily (not at module scope) so a missing/misconfigured env
// var can never throw during the build or at import time - a build-time
// crash here would silently drop this whole route from the deployment
// instead of failing loudly at the one request that actually needs it.
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export type SendPushResult =
  | { ok: true }
  | { ok: false; dead: true; statusCode: number }
  | { ok: false; dead: false; statusCode?: number; message: string };

/**
 * dead:true (410 Gone / 404) means the subscription itself no longer
 * exists at the push service - the caller should delete it. Any other
 * failure is surfaced with its real status/message instead of being
 * swallowed, so a misconfiguration doesn't masquerade as "delivered".
 */
export async function sendPush(subscription: PushSubscriptionRow, payload: PushPayload): Promise<SendPushResult> {
  try {
    ensureVapidConfigured();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      // "high" maps to FCM's high-priority delivery flag, so Android tries
      // to wake and deliver immediately instead of batching it for the next
      // Doze/battery-saver maintenance window - the default ("normal") is
      // exactly what gets silently held for a long time on aggressive
      // Android skins (MIUI, EMUI, ColorOS, ...).
      { urgency: "high", TTL: 60 * 60 * 24 }
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const body = (error as { body?: string }).body;
    if (statusCode === 404 || statusCode === 410) return { ok: false, dead: true, statusCode };
    const message = body || (error as Error).message || "unknown error";
    console.error("[web-push] send failed:", statusCode, message);
    return { ok: false, dead: false, statusCode, message };
  }
}
