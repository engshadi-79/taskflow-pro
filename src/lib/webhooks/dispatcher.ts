import crypto from "node:crypto";
import { on } from "@/lib/foundation/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookKind } from "@/lib/types/developer";

type Endpoint = { id: string; url: string; secret: string; kind: WebhookKind };

/** One short line per event, reused by the Slack/Teams body shapes below -
 *  the generic {event, data} envelope carries the full payload already, so
 *  this text is only ever needed for the two chat-platform formats. */
function eventMessage(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "task.created":
      return `مهمة جديدة: ${payload.title}`;
    case "task.status_changed":
      return `تغيّرت حالة مهمة من ${payload.oldStatus} إلى ${payload.newStatus}`;
    case "task.completed":
      return "اكتملت مهمة";
    default:
      return eventType;
  }
}

/** Slack/Teams Incoming Webhooks expect their own fixed JSON shape, not the
 *  generic {event, data} envelope - see supabase/webhook_provider_kind.sql. */
function buildDeliveryBody(kind: WebhookKind, eventType: string, payload: unknown): unknown {
  if (kind === "generic") return { event: eventType, data: payload };

  const message = eventMessage(eventType, payload as Record<string, unknown>);
  if (kind === "slack") return { text: message };
  return { "@type": "MessageCard", "@context": "http://schema.org/extensions", summary: message, text: message };
}

/**
 * One synchronous best-effort POST per subscribed endpoint, logged either
 * way to webhook_deliveries - no retry queue/cron (see api_webhooks_v3.sql
 * header: this project's Vercel plan caps cron jobs at 2, both already
 * used by P15). emit()'s own per-handler try/catch (src/lib/foundation/
 * events.ts) means a slow/failing endpoint here can never break the
 * Server Action that triggered the event.
 */
async function deliverToEndpoint(
  supabase: ReturnType<typeof createAdminClient>,
  endpoint: Endpoint,
  eventType: string,
  payload: unknown
): Promise<void> {
  const body = JSON.stringify(buildDeliveryBody(endpoint.kind, eventType, payload));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Slack/Teams webhooks neither check nor expect this header - only send it
  // for the generic kind, where it's the only integrity check the receiver has.
  if (endpoint.kind === "generic") {
    headers["X-Monjez-Signature"] = crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");
  }

  let status: "delivered" | "failed" = "failed";
  let responseStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    });
    responseStatus = res.status;
    status = res.ok ? "delivered" : "failed";
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "فشل الاتصال";
  }

  await supabase.from("webhook_deliveries").insert({
    endpoint_id: endpoint.id,
    event_type: eventType,
    payload,
    status,
    response_status: responseStatus,
    error: errorMessage,
  });
}

async function dispatch(organizationId: string, eventType: string, payload: unknown): Promise<void> {
  const supabase = createAdminClient();
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret, kind")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .contains("events", [eventType])
    .returns<Endpoint[]>();

  if (!endpoints?.length) return;

  await Promise.all(endpoints.map((endpoint) => deliverToEndpoint(supabase, endpoint, eventType, payload)));
}

on("task.created", (p) => dispatch(p.organizationId, "task.created", p));
on("task.status_changed", (p) => dispatch(p.organizationId, "task.status_changed", p));
on("task.completed", (p) => dispatch(p.organizationId, "task.completed", p));
