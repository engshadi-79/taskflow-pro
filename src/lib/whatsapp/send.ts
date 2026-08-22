const GRAPH_API_VERSION = "v21.0";

/**
 * Every field here is business-initiated (a task assigned to you, a meeting
 * reminder, ...), never a reply to something the recipient sent - Meta's
 * Cloud API only allows freeform text within a 24h customer-service window,
 * so outside that this must always go through one pre-approved message
 * template. One generic template (name below) with a single body variable
 * covers every notification type instead of needing one template per type.
 */
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "monjez_notification";
const TEMPLATE_LANGUAGE = "ar";

export type SendWhatsappResult = { ok: boolean; error?: string };

/** Meta expects country code + subscriber number, digits only (no "+", spaces, or leading 00). */
function normalizePhoneNumber(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^00/, "");
}

/**
 * Never throws: a failed WhatsApp send must never break the push-notification
 * fan-out it rides alongside in the notification-created webhook.
 */
export async function sendWhatsappMessage({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<SendWhatsappResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "WHATSAPP_ACCESS_TOKEN أو WHATSAPP_PHONE_NUMBER_ID غير مضبوطين" };
  }

  const recipient = normalizePhoneNumber(to);
  if (!recipient) {
    return { ok: false, error: "رقم واتساب غير صالح" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: TEMPLATE_LANGUAGE },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: message }],
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `WhatsApp ${response.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "فشل إرسال رسالة واتساب" };
  }
}
