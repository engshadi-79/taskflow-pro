import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailShell, getAppUrl } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` when it
 * invokes a route listed in vercel.json's `crons` array, if CRON_SECRET is
 * set as a project env var - this is the unattended-context equivalent of
 * the role check every server action does before touching createAdminClient().
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type PrefRow = { user_id: string; last_digest_email_at: string | null };

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: prefsRows, error } = await supabase
    .from("user_notification_preferences")
    .select("user_id, last_digest_email_at")
    .eq("digest_mode", "daily")
    .eq("email_digest_enabled", true)
    .returns<PrefRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const pref of prefsRows ?? []) {
    // send_notification_digests() (pg_cron) inserts at most one
    // 'digest_summary' row per user per day - the freshest one not yet
    // emailed is exactly what's due now.
    const { data: notif } = await supabase
      .from("notifications")
      .select("message, created_at")
      .eq("user_id", pref.user_id)
      .eq("type", "digest_summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!notif) continue;
    if (pref.last_digest_email_at && new Date(notif.created_at) <= new Date(pref.last_digest_email_at)) {
      continue;
    }

    const { data: user } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", pref.user_id)
      .maybeSingle();
    if (!user?.email) continue;

    const html = emailShell(
      "ملخصك اليومي",
      `<p style="font-size: 14px; color: #374151; line-height: 1.7;">مرحبًا ${user.full_name}،</p>
       <p style="font-size: 14px; color: #374151; line-height: 1.7;">${notif.message}</p>`,
      `${getAppUrl()}/dashboard/notifications`,
      "فتح مركز الإشعارات"
    );

    const result = await sendEmail({ to: user.email, subject: "ملخصك اليومي — منجز", html });
    if (result.error) {
      failed++;
      console.error(`[cron:daily-digest-emails] send failed for ${pref.user_id}:`, result.error);
      continue;
    }

    sent++;
    await supabase
      .from("user_notification_preferences")
      .update({ last_digest_email_at: new Date().toISOString() })
      .eq("user_id", pref.user_id);
  }

  return NextResponse.json({ sent, failed, checked: prefsRows?.length ?? 0 });
}
