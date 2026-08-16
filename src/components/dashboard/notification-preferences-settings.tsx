"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notification-preferences";
import { NOTIFICATION_CATEGORIES, type UserNotificationPreferences } from "@/lib/types/notification";
import type { Role } from "@/lib/types/roles";

export function NotificationPreferencesSettings({ role }: { role: Role }) {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
  }, []);

  async function save(next: UserNotificationPreferences) {
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    const result = await updateNotificationPreferences(next);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <section>
      <p className="mb-3 text-[11.5px] leading-5 text-muted">
        تُحفظ على حسابك وتنطبق على كل أجهزتك.
      </p>

      {!prefs ? (
        <p className="text-[12px] text-muted">جارِ التحميل...</p>
      ) : (
        <>
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] font-bold text-foreground">أنواع الإشعارات المفعّلة</legend>
            <div className="max-h-[92px] overflow-y-auto rounded-[10px] border border-border">
              {NOTIFICATION_CATEGORIES.map((cat, i) => {
                const isMuted = cat.types.every((t) => prefs.muted_types.includes(t));
                return (
                  <label
                    key={cat.key}
                    className={`flex cursor-pointer items-center justify-between gap-3 border-s-[3px] px-3 py-2 text-[13px] font-bold hover:bg-background ${
                      i > 0 ? "border-t border-t-border" : ""
                    } ${isMuted ? "border-s-transparent text-muted" : "border-s-accent-500 text-foreground"}`}
                  >
                    {cat.label}
                    <input
                      type="checkbox"
                      checked={!isMuted}
                      disabled={saving}
                      onChange={(e) => {
                        const muteNow = !e.target.checked;
                        const set = new Set(prefs.muted_types);
                        cat.types.forEach((t) => (muteNow ? set.add(t) : set.delete(t)));
                        save({ ...prefs, muted_types: [...set] });
                      }}
                      className="h-4 w-4 accent-accent-600"
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 space-y-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background">
              <span>
                عدم الإزعاج
                <span className="mt-0.5 block text-[11px] font-medium text-muted">
                  يوقف التنبيه الفوري خلال هذه الفترة؛ تبقى الإشعارات بانتظارك في الجرس
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs.dnd_enabled}
                disabled={saving}
                onChange={(e) => save({ ...prefs, dnd_enabled: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-accent-600"
              />
            </label>

            {prefs.dnd_enabled && (
              <div className="flex items-center gap-2 ps-1">
                <input
                  type="time"
                  value={prefs.dnd_start_time.slice(0, 5)}
                  disabled={saving}
                  onChange={(e) => save({ ...prefs, dnd_start_time: e.target.value })}
                  className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <span className="text-[12px] text-muted">إلى</span>
                <input
                  type="time"
                  value={prefs.dnd_end_time.slice(0, 5)}
                  disabled={saving}
                  onChange={(e) => save({ ...prefs, dnd_end_time: e.target.value })}
                  className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            )}

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background">
              <span>
                ملخص يومي بدل كل إشعار على حدة
                <span className="mt-0.5 block text-[11px] font-medium text-muted">
                  رسالة واحدة صباحًا بدل تنبيه فوري لكل إشعار
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs.digest_mode === "daily"}
                disabled={saving}
                onChange={(e) =>
                  save({
                    ...prefs,
                    digest_mode: e.target.checked ? "daily" : "off",
                    email_digest_enabled: e.target.checked ? prefs.email_digest_enabled : false,
                  })
                }
                className="h-4 w-4 shrink-0 accent-accent-600"
              />
            </label>

            {prefs.digest_mode === "daily" && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background ms-4">
                <span>
                  أرسل لي الملخص اليومي بالبريد أيضًا
                  <span className="mt-0.5 block text-[11px] font-medium text-muted">
                    بالإضافة إلى ظهوره في الجرس داخل التطبيق
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.email_digest_enabled}
                  disabled={saving}
                  onChange={(e) => save({ ...prefs, email_digest_enabled: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-accent-600"
                />
              </label>
            )}

            {(role === "super_admin" || role === "department_manager") && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background">
                <span>
                  تقرير أداء أسبوعي بالبريد
                  <span className="mt-0.5 block text-[11px] font-medium text-muted">
                    ملخص أسبوعي لأداء {role === "department_manager" ? "قسمك" : "المؤسسة"} كل يوم اثنين
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.weekly_report_email_enabled}
                  disabled={saving}
                  onChange={(e) => save({ ...prefs, weekly_report_email_enabled: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-accent-600"
                />
              </label>
            )}
          </div>

          {saved && (
            <p className="mt-2 text-[11.5px] text-green-600" role="status">
              تم الحفظ
            </p>
          )}
          {error && (
            <p className="mt-2 text-[11.5px] text-red-600" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
