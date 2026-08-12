import Link from "next/link";
import { CheckIcon, InboxIcon, AlertIcon } from "@/components/shared/icons";

/** Compact "مهامي" summary - today/overdue counts for whoever is viewing,
 * regardless of role. Purely presentational, server-rendered. */
export function MyTasksSummaryWidget({
  overdueCount,
  dueTodayCount,
}: {
  overdueCount: number;
  dueTodayCount: number;
}) {
  const hasUrgent = overdueCount > 0 || dueTodayCount > 0;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/tasks"
          className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-muted hover:bg-background"
        >
          عرض الكل
        </Link>
        <div className="flex items-center gap-2">
          <h2 className="text-[14.5px] font-extrabold text-foreground">مهامي</h2>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <InboxIcon className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-muted">
          <InboxIcon className="h-3.5 w-3.5 text-accent-500" />
          اليوم: {dueTodayCount}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-brand-red-500">
          <AlertIcon className="h-3.5 w-3.5" />
          متأخرة: {overdueCount}
        </span>
      </div>

      {!hasUrgent && (
        <div className="flex flex-col items-center gap-2.5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-500">
            <CheckIcon className="h-6 w-6" />
          </span>
          <p className="text-[13px] text-muted">لا توجد مهام عاجلة</p>
        </div>
      )}
    </div>
  );
}
