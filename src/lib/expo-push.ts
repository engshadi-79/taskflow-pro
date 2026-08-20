export type ExpoPushResult = { ok: true } | { ok: false; dead: true } | { ok: false; dead: false; message: string };

type ExpoTicket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/**
 * One HTTP call for the whole batch - Expo's push API accepts an array and
 * returns tickets in the same order, no per-token round trip needed.
 * "DeviceNotRegistered" is Expo's equivalent of Web Push's 410 Gone: the
 * token is permanently invalid and the caller should delete it.
 */
export async function sendExpoPush(
  tokens: string[],
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<ExpoPushResult[]> {
  if (tokens.length === 0) return [];

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: { url: payload.url, tag: payload.tag },
        priority: "high",
        channelId: "default",
      }))
    ),
  });

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    console.error("[expo-push] batch send failed:", res.status, message);
    return tokens.map(() => ({ ok: false, dead: false, message }));
  }

  const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
  const tickets = json?.data ?? [];

  return tokens.map((_, i) => {
    const ticket = tickets[i];
    if (!ticket) return { ok: false, dead: false, message: "no ticket returned" };
    if (ticket.status === "ok") return { ok: true };
    if (ticket.details?.error === "DeviceNotRegistered") return { ok: false, dead: true };
    return { ok: false, dead: false, message: ticket.message || "unknown error" };
  });
}
