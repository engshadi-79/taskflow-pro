import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writes into the existing public.activity_log (schema.sql) - already a
 * generic table (organization_id/user_id/action_type/entity_type/
 * entity_id/description), but until now only ever written to by one SQL
 * trigger (task activity). Any Server Action for a sensitive operation
 * can call this directly, in any domain, without a new table per feature.
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    organizationId: string;
    userId: string | null;
    actionType: string;
    entityType: string;
    entityId?: string | null;
    description?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    organization_id: entry.organizationId,
    user_id: entry.userId,
    action_type: entry.actionType,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    description: entry.description ?? null,
  });

  // Audit logging failing must never fail the operation it's logging -
  // the mutation already succeeded by the time this runs.
  if (error) console.error("audit log insert failed", error);
}
