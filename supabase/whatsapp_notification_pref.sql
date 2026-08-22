-- Opt-in toggle for the WhatsApp notification channel (src/lib/whatsapp/send.ts).
-- Off by default: WhatsApp messages go through Meta's paid Cloud API and are
-- more intrusive than an in-app/push notification, so this is never sent
-- unless the user both saved a whatsapp number (profile_whatsapp.sql) AND
-- explicitly turned this on.
alter table public.user_notification_preferences
  add column if not exists whatsapp_notifications_enabled boolean not null default false;
