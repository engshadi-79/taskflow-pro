"use client";

import { useEffect, useState } from "react";
import { startTimer, stopTimer, deleteTimeEntry } from "@/lib/actions/time-entries";

type EntryRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  user: { full_name: string } | null;
};

function formatHours(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours}س ${minutes}د`;
}

export function TimeTrackingSection({
  taskId,
  entries,
  estimatedHours,
  actualSeconds,
  hasRunning,
  currentUserId,
  /** This user's open entry anywhere (any task) - null if none. Needed to
   * tell "not started" apart from "running on a different task", since
   * task_time_entries_no_overlap only allows one open entry per user at all. */
  myOpenEntry,
  canDeleteAny,
}: {
  taskId: string;
  entries: EntryRow[];
  estimatedHours: number | null;
  actualSeconds: number;
  hasRunning: boolean;
  currentUserId: string;
  myOpenEntry: { id: string; task_id: string } | null;
  canDeleteAny: boolean;
}) {
  const [liveSeconds, setLiveSeconds] = useState(actualSeconds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // purely a live display tick while a timer runs - the stored value is
  // always computed server-side from started_at/ended_at (see
  // task_time_summary in time_tracking.sql), never from this interval
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  const plannedSeconds = estimatedHours ? estimatedHours * 3600 : null;
  const diffSeconds = plannedSeconds !== null ? liveSeconds - plannedSeconds : null;

  const myEntryOnThisTask = myOpenEntry?.task_id === taskId ? myOpenEntry : null;
  const runningElsewhere = myOpenEntry && myOpenEntry.task_id !== taskId;

  return (
    <section className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      <h2 className="text-sm font-extrabold text-foreground">تتبّع الوقت</h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-border bg-background p-3.5 text-center">
          <div className="font-display text-[18px] text-foreground">
            {plannedSeconds !== null ? formatHours(plannedSeconds) : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">الوقت المخطط</div>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5 text-center">
          <div className="font-display text-[18px] text-accent-600">{formatHours(liveSeconds)}</div>
          <div className="mt-0.5 text-[11px] text-muted">الوقت الفعلي</div>
        </div>
        <div className="rounded-[14px] border border-border bg-background p-3.5 text-center">
          <div
            className={`font-display text-[18px] ${
              diffSeconds !== null && diffSeconds > 0 ? "text-brand-red-500" : "text-green-600"
            }`}
          >
            {diffSeconds !== null ? formatHours(Math.abs(diffSeconds)) : "—"}
            {diffSeconds !== null && (diffSeconds > 0 ? "+" : diffSeconds < 0 ? "-" : "")}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">الفرق</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {myEntryOnThisTask ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await stopTimer(myEntryOnThisTask.id, taskId);
              setPending(false);
              if (result?.error) setError(result.error);
            }}
            className="rounded-[10px] bg-brand-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-red-600 disabled:opacity-60"
          >
            إيقاف التوقيت
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !!runningElsewhere}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await startTimer(taskId);
              setPending(false);
              if (result?.error) setError(result.error);
            }}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            بدء التوقيت
          </button>
        )}
        {runningElsewhere && (
          <p className="text-sm text-muted">لديك جلسة توقيت مفتوحة على مهمة أخرى</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
          >
            <span className="font-medium text-foreground">{entry.user?.full_name ?? "—"}</span>
            <span className="text-muted">
              {new Date(entry.started_at).toLocaleString("ar")}
              {entry.ended_at ? ` — ${formatHours(entry.duration_seconds ?? 0)}` : " — جارٍ الآن"}
            </span>
            {entry.note && <span className="text-[12px] text-faint">{entry.note}</span>}
            {(canDeleteAny || entry.user_id === currentUserId) && (
              <DeleteEntryButton id={entry.id} taskId={taskId} />
            )}
          </li>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted">لا يوجد سجل زمني بعد</p>}
      </ul>
    </section>
  );
}

function DeleteEntryButton({ id, taskId }: { id: string; taskId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("حذف هذه الجلسة الزمنية؟")) return;
        setPending(true);
        await deleteTimeEntry(id, taskId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
