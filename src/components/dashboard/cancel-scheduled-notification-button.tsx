"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelScheduledAdminNotification } from "@/lib/actions/admin-notifications";

export function CancelScheduledNotificationButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    setPending(true);
    setError(null);
    const result = await cancelScheduledAdminNotification(notificationId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={handleCancel}
        className="rounded-md border border-red-200 px-3 py-1.5 text-[12.5px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        إلغاء الإشعار المجدول
      </button>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
