/**
 * A tiny in-process domain event bus - one Next.js server, not
 * distributed, and not a replacement for the decoupling this codebase
 * already gets from Postgres triggers + pg_cron (task/project automation
 * dispatch, SLA breach detection, scheduled notifications). Those stay
 * exactly as they are.
 *
 * This exists for JS-side side effects that don't belong inside a DB
 * trigger: a Server Action emits a fact ("this happened"), and anything
 * that cares can subscribe without the action itself knowing who's
 * listening - e.g. a future webhook dispatcher (P18) could subscribe to
 * "admin_notification.sent" without admin-notifications.ts ever
 * importing anything webhook-related.
 *
 * Add new event names/payloads here as real emitters need them - this is
 * intentionally not a general "any string, any payload" bus.
 */

type EventPayloads = {
  "admin_notification.sent": {
    organizationId: string;
    userId: string;
    notificationId: string;
    recipientCount: number;
  };
  "organization_settings.updated": {
    organizationId: string;
    userId: string;
  };
};

export type DomainEvent = keyof EventPayloads;
type Handler<E extends DomainEvent> = (payload: EventPayloads[E]) => void | Promise<void>;

// Internally untyped (a single bag keyed by event name) - external callers
// only ever see the fully-typed on()/emit() signatures below.
const handlers: Record<string, Handler<DomainEvent>[]> = {};

export function on<E extends DomainEvent>(event: E, handler: Handler<E>): void {
  (handlers[event] ??= []).push(handler as Handler<DomainEvent>);
}

export async function emit<E extends DomainEvent>(event: E, payload: EventPayloads[E]): Promise<void> {
  const list = handlers[event];
  if (!list) return;
  for (const handler of list) {
    try {
      await handler(payload);
    } catch (err) {
      // a subscriber failing must never break the action that emitted the
      // event - it already succeeded before the event fired
      console.error(`Domain event handler failed for "${event}"`, err);
    }
  }
}
