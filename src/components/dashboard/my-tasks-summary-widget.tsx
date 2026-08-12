import Link from "next/link";
import { CheckIcon, InboxIcon, AlertIcon } from "@/components/shared/icons";

type UrgentTask = { id: string; title: string; due_date: string | null };

/** Compact "مهامي" summary - today/overdue counts for whoever is viewing,
 * regardless of role. Purely presentational, server-rendered. `tasks`
 * is the actual due-today/overdue rows (capped upstream, e.g. 5) so the
 * chips aren't just numbers with nothing to click through to. */
export function MyTasksSummaryWidget({
  overdueCount,
  dueTodayCount,
  tasks,
}: {
  overdueCount: number;
  dueTodayCount: number;
  tasks: UrgentTask[];
}) {
  const hasUrgent = overdueCount > 0 || dueTodayCount > 0;
  const todayIso = new Date().toISOString().slice(0, 10);

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

      {hasUrgent && (
        <div className="space-y-1.5">
          {tasks.map((t) => {
            const isOverdue = !!t.due_date && t.due_date.slice(0, 10) < todayIso;
            return (
              <Link
                key={t.id}
                href={`/dashboard/tasks/${t.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12.5px] hover:bg-background"
              >
                <span className="truncate font-semibold text-foreground">{t.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    isOverdue ? "bg-red-50 text-red-600" : "bg-accent-50 text-accent-600"
                  }`}
                >
                  {isOverdue ? "متأخرة" : "اليوم"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

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
