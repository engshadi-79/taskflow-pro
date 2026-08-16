import crypto from "node:crypto";
import { on } from "@/lib/foundation/events";
import { createAdminClient } from "@/lib/supabase/admin";

type Endpoint = { id: string; url: string; secret: string };

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
  const body = JSON.stringify({ event: eventType, data: payload });
  const signature = crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");

  let status: "delivered" | "failed" = "failed";
  let responseStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Monjez-Signature": signature },
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
    .select("id, url, secret")
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
