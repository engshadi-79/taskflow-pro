import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types/organization";

/** organizations_select RLS already scopes this to exactly the caller's
 * own org - no .eq() needed, there's only ever one visible row. */
export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").single<Organization>();
  return data;
}
