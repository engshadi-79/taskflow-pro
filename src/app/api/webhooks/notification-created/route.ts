import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/web-push";
import { sendExpoPush } from "@/lib/expo-push";

export const dynamic = "force-dynamic";

/**
 * Same shape as CRON_SECRET auth on the Vercel Cron routes - Supabase
 * Database Webhooks let you attach a custom header, configured to send
 * `Authorization: Bearer ${SUPABASE_WEBHOOK_SECRET}` (see setup steps given
 * alongside supabase/push_notifications.sql).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type NotificationRow = {
  id: string;
  user_id: string;
  title: string | null;
  message: string;
  type: string;
  task_id: string | null;
  meeting_id: string | null;
  conversation_id: string | null;
};

/** Best-effort deep link so tapping the push opens the right screen. */
function urlForNotification(n: NotificationRow): string {
  if (n.task_id) return `/m/tasks/${n.task_id}`;
  if (n.meeting_id) return `/m/meetings/${n.meeting_id}`;
  if (n.conversation_id) return `/m/chat/${n.conversation_id}`;
  return "/m/notifications";
}

/** Same deep link, but as a route inside the native app instead of the web app. */
function expoUrlForNotification(n: NotificationRow): string {
  if (n.task_id) return `/tasks/${n.task_id}`;
  if (n.meeting_id) return `/more/meetings/${n.meeting_id}`;
  if (n.conversation_id) return `/more/chat/${n.conversation_id}`;
  return "/notifications";
}

/** Supabase's Database Webhook payload shape for an INSERT event. */
type WebhookBody = { type: "INSERT"; table: string; record: NotificationRow };

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = (await req.json()) as WebhookBody;
  if (body.type !== "INSERT" || body.table !== "notifications") {
    return NextResponse.json({ skipped: true });
  }

  const notification = body.record;
  const supabase = createAdminClient();

  const [{ data: subscriptions }, { data: expoTokens }] = await Promise.all([
    supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", notification.user_id),
    supabase.from("expo_push_tokens").select("id, token").eq("user_id", notification.user_id),
  ]);

  let sent = 0;
  const deadIds: string[] = [];
  const deadExpoIds: string[] = [];
  const errors: { endpoint: string; statusCode?: number; message: string }[] = [];

  await Promise.all([
    ...(subscriptions ?? []).map(async (sub) => {
      const result = await sendPush(sub, {
        title: notification.title || "منجز",
        body: notification.message,
        url: urlForNotification(notification),
        tag: notification.id,
      });
      if (result.ok) {
        sent++;
      } else if (result.dead) {
        deadIds.push(sub.id);
      } else {
        errors.push({ endpoint: sub.endpoint.slice(-24), statusCode: result.statusCode, message: result.message });
      }
    }),
    (async () => {
      if (!expoTokens?.length) return;
      const results = await sendExpoPush(
        expoTokens.map((t) => t.token),
        { title: notification.title || "منجز", body: notification.message, url: expoUrlForNotification(notification), tag: notification.id }
      );
      results.forEach((result, i) => {
        if (result.ok) {
          sent++;
        } else if (result.dead) {
          deadExpoIds.push(expoTokens[i].id);
        } else {
          errors.push({ endpoint: `expo:${expoTokens[i].token.slice(-24)}`, message: result.message });
        }
      });
    })(),
  ]);

  if (deadIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", deadIds);
  }
  if (deadExpoIds.length) {
    await supabase.from("expo_push_tokens").delete().in("id", deadExpoIds);
  }

  return NextResponse.json({ sent, removed: deadIds.length + deadExpoIds.length, errors });
}
