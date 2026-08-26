-- Adds payment method + reference to an upgrade request, so a submission
-- is connected to an actual transfer instead of being a bare free-text
-- note. No payment processor/webhook - the platform owner still verifies
-- and activates manually via /dashboard/platform, this just gives them
-- something concrete to verify against.

alter table public.plan_upgrade_requests
  add column payment_method text check (payment_method in ('bank_transfer', 'binance')),
  add column payment_reference text;
