const ULTRAMSG_API_URL = "https://api.ultramsg.com";

export type SendWhatsappResult = { ok: boolean; error?: string };

/** UltraMsg expects country code + subscriber number, digits only (no "+", spaces, or leading 00). */
function normalizePhoneNumber(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^00/, "");
}

/**
 * UltraMsg links a real WhatsApp number (scanned via QR in their dashboard)
 * instead of Meta's official Cloud API, so this sends plain freeform text -
 * no pre-approved message template needed. Never throws: a failed WhatsApp
 * send must never break the push-notification fan-out it rides alongside in
 * the notification-created webhook.
 */
export async function sendWhatsappMessage({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<SendWhatsappResult> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    return { ok: false, error: "ULTRAMSG_INSTANCE_ID أو ULTRAMSG_TOKEN غير مضبوطين" };
  }

  const recipient = normalizePhoneNumber(to);
  if (!recipient) {
    return { ok: false, error: "رقم واتساب غير صالح" };
  }

  try {
    const response = await fetch(`${ULTRAMSG_API_URL}/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, to: recipient, body: message }),
    });

    const text = await response.text();
    let data: { error?: string } | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      // UltraMsg returns plain JSON on success too; a non-JSON body here
      // just means we fall through to the raw text in the error message.
    }

    if (!response.ok || data?.error) {
      return { ok: false, error: `UltraMsg ${response.status}: ${data?.error ?? text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "فشل إرسال رسالة واتساب" };
  }
}
