import { ClockIcon, PlusIcon, RefreshIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";

export type TaskTimelineEntry = {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  user: { full_name: string } | null;
};

const ICON_FOR: Record<string, React.ReactNode> = {
  create: <PlusIcon className="h-3.5 w-3.5" />,
  status_change: <RefreshIcon className="h-3.5 w-3.5" />,
};

/**
 * Reads straight from activity_log (entity_type='task') - the same table
 * that already feeds the dashboard's "آخر النشاطات" panel, per Prompt 00's
 * "don't build a parallel system" rule. Nothing new is logged here; this
 * just surfaces what log_task_activity() already writes on every create/
 * status-change, scoped per-task by activity_log_select_task.
 */
export function TaskTimeline({ entries }: { entries: TaskTimelineEntry[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">سجل الأحداث</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">لا يوجد سجل أحداث بعد</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                {ICON_FOR[entry.action_type] ?? <ClockIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-foreground">{entry.description}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
                  {entry.user?.full_name && <span className="font-bold text-muted">{entry.user.full_name}</span>}
                  <span>{timeAgo(entry.created_at)}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
