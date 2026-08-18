"use client";

import Link from "next/link";
import { useState } from "react";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { BellIcon } from "@/components/shared/icons";
import type { Notification } from "@/lib/types/notification";

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const [items, setItems] = useState(notifications);
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <button
          type="button"
          onClick={async () => {
            await markAllNotificationsRead();
            setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
          }}
          className="text-sm text-accent-600 hover:underline"
        >
          تحديد الكل كمقروء
        </button>
      )}

      <ul className="space-y-2">
        {items.map((notification) => {
          const card = (
            <div
              className={`rounded-[14px] border p-4 text-sm transition-colors ${
                notification.is_read ? "border-border bg-surface" : "border-accent-300 bg-accent-50"
              } ${
                notification.task_id
                  ? notification.is_read
                    ? "hover:bg-background"
                    : "hover:bg-accent-100"
                  : ""
              }`}
            >
              {notification.title && (
                <p className="mb-1 font-extrabold text-foreground">{notification.title}</p>
              )}
              <p className="text-foreground">{notification.message}</p>
              <p className="mt-1 text-xs text-muted">
                {new Date(notification.created_at).toLocaleString("ar")}
              </p>
            </div>
          );

          return (
            <li key={notification.id}>
              {notification.task_id ? (
                <Link
                  href={`/dashboard/tasks/${notification.task_id}`}
                  onClick={async () => {
                    if (notification.is_read) return;
                    await markNotificationRead(notification.id);
                    setItems((prev) =>
                      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
                    );
                  }}
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
              <BellIcon className="h-5 w-5" />
            </span>
            <p className="text-[13px] text-muted">لا توجد إشعارات</p>
          </li>
        )}
      </ul>
    </div>
  );
}
