import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Claims `key` before a sensitive or cron-triggered mutation runs.
 * Returns false if the key was already claimed (a double form submit, a
 * cron retry after a timeout) - the caller should skip the mutation
 * entirely in that case, since it already happened once.
 */
export async function claimIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
  organizationId: string,
  userId: string | null
): Promise<boolean> {
  const { error } = await supabase.from("idempotency_keys").insert({
    key,
    organization_id: organizationId,
    user_id: userId,
  });

  if (error) {
    // 23505 = unique_violation - the key already exists, meaning this
    // exact operation was already claimed
    if (error.code === "23505") return false;
    // any other DB error must not silently let a duplicate through
    throw error;
  }
  return true;
}
