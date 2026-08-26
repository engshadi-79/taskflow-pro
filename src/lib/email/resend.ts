const RESEND_API_URL = "https://api.resend.com/emails";

/** Vercel provides VERCEL_PROJECT_PRODUCTION_URL/VERCEL_URL automatically -
 *  no env var to set there. Any other deployment (e.g. the VPS trial
 *  instance, which isn't Vercel and has its own BASE_PATH prefix) needs
 *  NEXT_PUBLIC_APP_URL set explicitly, or every link this builds
 *  (invite links, signup confirmation redirects) would fall through to
 *  localhost and be useless to whoever clicks them. */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

export type SendEmailResult = { error?: string };

/**
 * Raw fetch, not the `resend` SDK - this project has zero HTTP client
 * dependencies (relies on global fetch everywhere, see @google/genai usage
 * in src/lib/ai/*), and Resend's API is a single JSON POST, so adding a
 * dependency for it isn't worth it. Never throws: a scheduled-email failure
 * must never crash the cron route mid-batch, just skip that one recipient.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY غير مضبوط على الخادم" };

  const from = process.env.RESEND_FROM_EMAIL || "MONJEZ <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { error: `Resend ${response.status}: ${body}` };
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "فشل إرسال البريد" };
  }
}

/** Shared branded wrapper so both scheduled emails look like the same product. */
export function emailShell(title: string, bodyHtml: string, ctaHref: string, ctaLabel: string): string {
  return `
    <div style="font-family: Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; direction: rtl; text-align: right;">
      <div style="background: linear-gradient(90deg, #6d28d9, #4f46e5); border-radius: 16px 16px 0 0; padding: 24px;">
        <h1 style="margin: 0; color: #fff; font-size: 20px;">${title}</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
        ${bodyHtml}
        <a href="${ctaHref}" style="display: inline-block; margin-top: 16px; background: #4f46e5; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; font-size: 13px;">
          ${ctaLabel}
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 11px; margin-top: 12px;">
        منجز (MONJEZ) — يمكنك إيقاف هذه الرسائل من إعدادات تفضيلات الإشعارات داخل التطبيق.
      </p>
    </div>
  `;
}
