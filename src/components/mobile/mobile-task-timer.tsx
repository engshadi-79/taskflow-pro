"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startTimer, stopTimer } from "@/lib/actions/time-entries";

export function MobileTaskTimer({
  taskId,
  actualSeconds,
  hasRunning,
  myOpenEntry,
}: {
  taskId: string;
  actualSeconds: number;
  hasRunning: boolean;
  myOpenEntry: { id: string; task_id: string } | null;
}) {
  const router = useRouter();
  const [liveSeconds, setLiveSeconds] = useState(actualSeconds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  const hrs = Math.floor(liveSeconds / 3600);
  const mins = Math.floor((liveSeconds % 3600) / 60);
  const secs = liveSeconds % 60;
  const display = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const myEntryOnThisTask = myOpenEntry?.task_id === taskId ? myOpenEntry : null;
  const runningElsewhere = !!myOpenEntry && myOpenEntry.task_id !== taskId;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] font-extrabold text-foreground">تتبّع الوقت</span>
        <span className="font-display text-[15px] font-black text-accent-600 [font-variant-numeric:tabular-nums]">{display}</span>
      </div>
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
            else router.refresh();
          }}
          className="w-full rounded-[10px] bg-brand-red-50 py-2.5 text-[12.5px] font-extrabold text-brand-red-600 disabled:opacity-60"
        >
          ⏸ إيقاف مؤقت
        </button>
      ) : (
        <button
          type="button"
          disabled={pending || runningElsewhere}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await startTimer(taskId);
            setPending(false);
            if (result?.error) setError(result.error);
            else router.refresh();
          }}
          className="w-full rounded-[10px] bg-green-50 py-2.5 text-[12.5px] font-extrabold text-green-600 disabled:opacity-60"
        >
          ▶ بدء التتبع
        </button>
      )}
      {runningElsewhere && <p className="mt-1.5 text-[11.5px] text-muted">لديك جلسة توقيت مفتوحة على مهمة أخرى</p>}
      {error && <p className="mt-1.5 text-[11.5px] text-brand-red-600">{error}</p>}
    </div>
  );
}
