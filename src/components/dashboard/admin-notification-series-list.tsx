"use client";

import { useState } from "react";
import { cancelAdminNotificationSeries } from "@/lib/actions/admin-notifications";

type SeriesRow = {
  id: string;
  title: string;
  recurrence_pattern: string;
  recurrence_interval: number;
  next_run_at: string;
};

const PATTERN_LABEL: Record<string, string> = {
  daily: "يوميًا",
  weekly: "أسبوعيًا",
  monthly: "شهريًا",
  yearly: "سنويًا",
};

export function AdminNotificationSeriesList({ series }: { series: SeriesRow[] }) {
  const [items, setItems] = useState(series);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(id: string) {
    setError(null);
    const result = await cancelAdminNotificationSeries(id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">الإشعارات المتكررة النشطة</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
            <div>
              <p className="text-[13px] font-bold text-foreground">{s.title}</p>
              <p className="text-[11.5px] text-muted">
                {PATTERN_LABEL[s.recurrence_pattern] ?? s.recurrence_pattern}
                {s.recurrence_interval > 1 ? ` (كل ${s.recurrence_interval})` : ""} — التالي: {new Date(s.next_run_at).toLocaleString("ar")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCancel(s.id)}
              className="rounded-full border border-red-200 px-3 py-1.5 text-[11.5px] font-bold text-red-600 hover:bg-red-50"
            >
              إلغاء التكرار
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
