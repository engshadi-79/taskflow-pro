import { createClient } from "@/lib/supabase/client";
import { addComment, reviewTask, submitForReview } from "@/lib/actions/tasks";
import { getAllPending, markConflict, removeMutation, type PendingMutation } from "@/lib/offline/queue";

/**
 * Replays every queued mutation through the exact same server actions the
 * online path uses - no parallel/bypass logic, so every role/permission/RLS
 * check in tasks.ts still applies. status_change/review_decision mutations
 * are conflict-checked against the task's current updated_at first (see
 * markConflict below); comments are purely additive and always replay.
 */
export async function syncPendingMutations(): Promise<void> {
  const pending = await getAllPending();
  for (const mutation of pending) {
    if (mutation.status === "conflict") continue;
    try {
      await replayMutation(mutation);
    } catch {
      // stays queued - will retry on the next sync (next reconnect or mount)
    }
  }
}

async function replayMutation(mutation: PendingMutation): Promise<void> {
  if (mutation.kind === "comment") {
    const formData = new FormData();
    formData.set("task_id", mutation.taskId);
    formData.set("content", mutation.content);
    await addComment({}, formData);
    await removeMutation(mutation.id);
    return;
  }

  const supabase = createClient();
  const { data: current } = await supabase.from("tasks").select("updated_at").eq("id", mutation.taskId).single();

  if (!current || current.updated_at !== mutation.baseUpdatedAt) {
    // Someone else changed this task while we were offline - don't silently
    // overwrite them. Leave it queued and flag it for the user to resolve.
    await markConflict(mutation.id);
    return;
  }

  if (mutation.kind === "submit_for_review") {
    const result = await submitForReview(mutation.taskId);
    if (result?.error) return; // stays queued, will retry
  } else {
    const result = await reviewTask(mutation.taskId, mutation.decision, mutation.notes);
    if (result?.error) return;
  }

  await removeMutation(mutation.id);
}
