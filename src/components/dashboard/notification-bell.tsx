"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BellIcon } from "@/components/shared/icons";

export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const [count, setCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => setCount((c) => c + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label="الإشعارات"
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition-colors hover:brightness-95"
    >
      <BellIcon className="h-[19px] w-[19px]" />
      {count > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
