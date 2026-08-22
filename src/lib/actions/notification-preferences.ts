"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { UserNotificationPreferences } from "@/lib/types/notification";

const DEFAULTS: UserNotificationPreferences = {
  muted_types: [],
  dnd_enabled: false,
  dnd_start_time: "22:00",
  dnd_end_time: "07:00",
  dnd_timezone: "Asia/Riyadh",
  digest_mode: "off",
  email_digest_enabled: false,
  weekly_report_email_enabled: false,
  whatsapp_notifications_enabled: false,
};

export type NotificationPreferencesState = { error?: string };

/**
 * Returns the caller's own row, or in-memory defaults (seeded from the
 * organization's timezone) if they've never opened this settings section
 * before - no row is written until they actually change something.
 */
export async function getNotificationPreferences(): Promise<UserNotificationPreferences> {
  const profile = await getCurrentProfile();
  if (!profile) return DEFAULTS;

  const supabase = await createClient();
  const [prefsResult, { data: org }] = await Promise.all([
    supabase
      .from("user_notification_preferences")
      .select(
        "muted_types, dnd_enabled, dnd_start_time, dnd_end_time, dnd_timezone, digest_mode, email_digest_enabled, weekly_report_email_enabled, whatsapp_notifications_enabled"
      )
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.from("organizations").select("timezone").eq("id", profile.organization_id).maybeSingle(),
  ]);

  let prefs: Partial<UserNotificationPreferences> | null = prefsResult.data;

  // email_scheduled_reports_v3.sql (P15) not applied yet on this database -
  // fall back to the P12 column set rather than showing every preference as
  // unset, same fallback shape as knowledge.ts's createArticle/updateArticle.
  if (prefsResult.error?.code === "42703") {
    const fallback = await supabase
      .from("user_notification_preferences")
      .select("muted_types, dnd_enabled, dnd_start_time, dnd_end_time, dnd_timezone, digest_mode")
      .eq("user_id", profile.id)
      .maybeSingle();
    prefs = fallback.data;
  }

  if (prefs) return { ...DEFAULTS, ...prefs } as UserNotificationPreferences;
  return { ...DEFAULTS, dnd_timezone: org?.timezone || DEFAULTS.dnd_timezone };
}

export async function updateNotificationPreferences(
  input: UserNotificationPreferences
): Promise<NotificationPreferencesState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const baseRow = {
    user_id: profile.id,
    muted_types: input.muted_types,
    dnd_enabled: input.dnd_enabled,
    dnd_start_time: input.dnd_start_time,
    dnd_end_time: input.dnd_end_time,
    dnd_timezone: input.dnd_timezone,
    digest_mode: input.digest_mode,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from("user_notification_preferences").upsert(
    {
      ...baseRow,
      email_digest_enabled: input.email_digest_enabled,
      weekly_report_email_enabled: input.weekly_report_email_enabled,
      whatsapp_notifications_enabled: input.whatsapp_notifications_enabled,
    },
    { onConflict: "user_id" }
  );

  // See getNotificationPreferences() - same fallback if email_scheduled_reports_v3.sql hasn't run yet.
  if (error?.code === "42703") {
    ({ error } = await supabase
      .from("user_notification_preferences")
      .upsert(baseRow, { onConflict: "user_id" }));
  }

  return error ? { error: "تعذر حفظ تفضيلات الإشعارات" } : {};
}
