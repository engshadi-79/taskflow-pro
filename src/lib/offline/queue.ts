import { idbDelete, idbGetAll, idbPut, MUTATIONS_STORE } from "@/lib/offline/db";

export type PendingMutation =
  | {
      id: string;
      kind: "submit_for_review";
      taskId: string;
      baseUpdatedAt: string;
      createdAt: string;
      status: "pending" | "conflict";
    }
  | {
      id: string;
      kind: "review_decision";
      taskId: string;
      decision: "approve" | "reject";
      notes: string;
      baseUpdatedAt: string;
      createdAt: string;
      status: "pending" | "conflict";
    }
  | {
      id: string;
      kind: "comment";
      taskId: string;
      content: string;
      createdAt: string;
      status: "pending";
    };

// Plain Omit collapses a discriminated union into the union of all its keys
// minus the omitted ones, losing the per-variant shape - this distributes
// Omit over each member instead, so the "kind" discriminant still narrows
// the rest of the object's fields correctly at every call site.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export async function enqueue(mutation: DistributiveOmit<PendingMutation, "id" | "createdAt" | "status">): Promise<void> {
  const full = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending" as const,
  } as PendingMutation;
  await idbPut(MUTATIONS_STORE, full);
}

export async function getAllPending(): Promise<PendingMutation[]> {
  return idbGetAll<PendingMutation>(MUTATIONS_STORE);
}

export async function getMutationsForTask(taskId: string): Promise<PendingMutation[]> {
  const all = await getAllPending();
  return all.filter((m) => m.taskId === taskId);
}

export async function removeMutation(id: string): Promise<void> {
  await idbDelete(MUTATIONS_STORE, id);
}

export async function markConflict(id: string): Promise<void> {
  const all = await getAllPending();
  const found = all.find((m) => m.id === id);
  if (found && found.kind !== "comment") {
    await idbPut(MUTATIONS_STORE, { ...found, status: "conflict" });
  }
}
