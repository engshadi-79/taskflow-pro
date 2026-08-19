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

/**
 * true = delivered (or queued by the push service); false = the
 * subscription is dead (410 Gone / 404) and the caller should delete it -
 * anything else just gets logged, since a transient push-service failure
 * shouldn't silently drop the subscription.
 */
export async function sendPush(subscription: PushSubscriptionRow, payload: PushPayload): Promise<boolean> {
  try {
    ensureVapidConfigured();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return false;
    console.error("[web-push] send failed:", error);
    return true;
  }
}
