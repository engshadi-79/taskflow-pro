import { createClient } from "@/lib/supabase/server";

export type FeatureFlag = {
  key: string;
  label: string;
  description: string;
  default_enabled: boolean;
};

export async function getFeatureCatalogue(): Promise<FeatureFlag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("key, label, description, default_enabled")
    .order("key")
    .returns<FeatureFlag[]>();
  return data ?? [];
}

/** An override always wins; a key with no override row falls back to the
 *  catalogue's own default_enabled. */
export async function getEnabledFeatureKeys(organizationId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const [{ data: catalogue }, { data: overrides }] = await Promise.all([
    supabase.from("feature_flags").select("key, default_enabled").returns<Pick<FeatureFlag, "key" | "default_enabled">[]>(),
    supabase
      .from("organization_feature_overrides")
      .select("feature_key, enabled")
      .eq("organization_id", organizationId)
      .returns<{ feature_key: string; enabled: boolean }[]>(),
  ]);

  const overrideByKey = new Map((overrides ?? []).map((o) => [o.feature_key, o.enabled]));
  const enabled = new Set<string>();
  for (const flag of catalogue ?? []) {
    if (overrideByKey.get(flag.key) ?? flag.default_enabled) enabled.add(flag.key);
  }
  return enabled;
}
