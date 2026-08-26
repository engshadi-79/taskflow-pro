"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueue, getMutationsForTask, removeMutation, type PendingMutation } from "@/lib/offline/queue";
import { syncPendingMutations } from "@/lib/offline/sync";

export function OfflineBanner() {
  return (
    <p className="rounded-[10px] bg-amber-50 px-3 py-2 text-[11.5px] font-bold text-amber-700">
      غير متصل - سيُزامَن التغيير عند عودة الاتصال
    </p>
  );
}

/**
 * Surfaces a conflicting queued mutation for this task (see markConflict in
 * sync.ts): the task changed on the server while the user's own change sat
 * offline in the queue, so it was never applied automatically. Lets the
 * user re-apply their change on top of the current server state, or drop it.
 */
export function TaskConflictAlert({ taskId }: { taskId: string }) {
  const [conflict, setConflict] = useState<PendingMutation | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMutationsForTask(taskId).then((mutations) => {
      const found = mutations.find((m) => m.status === "conflict") ?? null;
      if (!cancelled) setConflict(found);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (!conflict || conflict.kind === "comment") return null;

  async function applyAnyway() {
    if (!conflict || conflict.kind === "comment") return;
    setResolving(true);
    const supabase = createClient();
    const { data: current } = await supabase.from("tasks").select("updated_at").eq("id", taskId).single();
    await removeMutation(conflict.id);
    if (current) {
      if (conflict.kind === "submit_for_review") {
        await enqueue({ kind: "submit_for_review", taskId, baseUpdatedAt: current.updated_at });
      } else {
        await enqueue({
          kind: "review_decision",
          taskId,
          decision: conflict.decision,
          notes: conflict.notes,
          baseUpdatedAt: current.updated_at,
        });
      }
      await syncPendingMutations();
    }
    setResolving(false);
    setConflict(null);
  }

  async function discard() {
    if (!conflict) return;
    setResolving(true);
    await removeMutation(conflict.id);
    setResolving(false);
    setConflict(null);
  }

  return (
    <div className="rounded-[12px] border border-orange-200 bg-orange-50 p-3.5">
      <p className="mb-2.5 text-[12.5px] font-extrabold text-orange-800">
        تم تعديل هذه المهمة على الخادم أثناء انقطاع اتصالك، فلم يُطبَّق تغييرك المحلي تلقائيًا.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={resolving}
          onClick={applyAnyway}
          className="flex-1 rounded-[10px] bg-accent-600 py-2 text-[12px] font-extrabold text-white disabled:opacity-60"
        >
          تطبيق تغييري رغم ذلك
        </button>
        <button
          type="button"
          disabled={resolving}
          onClick={discard}
          className="flex-1 rounded-[10px] border border-border bg-surface py-2 text-[12px] font-extrabold text-foreground disabled:opacity-60"
        >
          تجاهل تغييري
        </button>
      </div>
    </div>
  );
}
