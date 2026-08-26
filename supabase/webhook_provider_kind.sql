-- MONJEZ 3.0 P19 — Slack/Teams integration via ready-made Incoming Webhooks
-- Adds a `kind` to the existing generic webhook_endpoints (P18) so the same
-- register-a-URL/subscribe-to-events/deliver-on-event pipeline can also
-- format its outgoing body for Slack's {"text": "..."} or Teams' MessageCard
-- shape, instead of building a separate OAuth-based integration nobody has
-- credentials for.

alter table public.webhook_endpoints
  add column kind text not null default 'generic' check (kind in ('generic', 'slack', 'teams'));
