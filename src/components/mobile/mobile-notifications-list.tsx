"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { timeAgo } from "@/lib/format-time-ago";
import type { Notification } from "@/lib/types/notification";

export function MobileNotificationsList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="px-4 pb-6">
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await markAllNotificationsRead();
              setPending(false);
              router.refresh();
            }}
            className="text-[12px] font-extrabold text-accent-600 disabled:opacity-60"
          >
            تعليم الكل كمقروء
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={async () => {
              if (n.is_read) return;
              await markNotificationRead(n.id);
              router.refresh();
            }}
            className={`flex items-start gap-2.5 rounded-[14px] p-3.5 text-start shadow-[0_4px_12px_rgba(30,41,59,.06)] ${
              n.is_read ? "bg-surface" : "bg-accent-50"
            }`}
          >
            <span className={`mt-1 h-[9px] w-[9px] shrink-0 rounded-full ${n.is_read ? "bg-faint" : "bg-accent-500"}`} />
            <div className="min-w-0 flex-1">
              <div className={`text-[12.5px] leading-relaxed ${n.is_read ? "font-semibold text-muted" : "font-extrabold text-foreground"}`}>
                {n.title && <span>{n.title} — </span>}
                {n.message}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-faint">{timeAgo(n.created_at)}</div>
            </div>
          </button>
        ))}
        {notifications.length === 0 && <p className="py-10 text-center text-[13px] text-muted">لا توجد إشعارات</p>}
      </div>
    </div>
  );
}
