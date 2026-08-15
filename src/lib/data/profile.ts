import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/roles";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: permissionKeys }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, organization_id, full_name, email, phone, role, department_id, job_title, avatar_url, is_active, created_at, dashboard_shortcuts"
      )
      .eq("id", user.id)
      .single<Omit<Profile, "permissionKeys">>(),
    supabase.rpc("get_user_permissions", { p_user_id: user.id }),
  ]);

  if (!profile) return null;

  return { ...profile, permissionKeys: permissionKeys ?? [] };
}
