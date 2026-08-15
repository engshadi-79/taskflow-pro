import type { SupabaseClient } from "@supabase/supabase-js";
import { RateLimitError } from "./errors";

/**
 * Counts rows in the shared rate_limit_hits table for `bucketKey` within
 * the last `windowSeconds`, throws RateLimitError if already at the
 * limit, otherwise records this attempt. One shared table for every
 * sensitive action across every domain, instead of a bespoke counting
 * query per feature (the pattern /api/ai/chat used against
 * ai_interactions before this existed).
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  opts: {
    bucketKey: string;
    organizationId: string;
    userId: string | null;
    limit: number;
    windowSeconds: number;
    message?: string;
  }
): Promise<void> {
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from("rate_limit_hits")
    .select("*", { count: "exact", head: true })
    .eq("bucket_key", opts.bucketKey)
    .gte("created_at", since);

  if ((count ?? 0) >= opts.limit) {
    throw new RateLimitError(opts.message);
  }

  await supabase.from("rate_limit_hits").insert({
    bucket_key: opts.bucketKey,
    organization_id: opts.organizationId,
    user_id: opts.userId,
  });
}
