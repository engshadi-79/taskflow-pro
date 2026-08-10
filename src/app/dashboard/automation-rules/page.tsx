import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { AutomationRulesManager } from "@/components/dashboard/automation-rules-manager";
import type { AutomationExecution, AutomationRule } from "@/lib/types/automation";

export default async function AutomationRulesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: rules }, { data: executions }, { data: employees }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("created_at").returns<AutomationRule[]>(),
    supabase
      .from("automation_executions")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(500)
      .returns<AutomationExecution[]>(),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  return (
    <AutomationRulesManager
      rules={rules ?? []}
      executions={executions ?? []}
      employees={employees ?? []}
    />
  );
}
