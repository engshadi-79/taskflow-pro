import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getEnabledFeatureKeys } from "@/lib/data/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/foundation/permissions";
import { AutomationRulesManager } from "@/components/dashboard/automation-rules-manager";
import type { AutomationExecution, AutomationRule, AutomationRuleTemplate } from "@/lib/types/automation";

export default async function AutomationRulesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!can.manageAutomationRules(profile)) {
    redirect("/dashboard");
  }

  const enabledFeatures = await getEnabledFeatureKeys(profile.organization_id);
  if (!enabledFeatures.has("automation_rules")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: rules }, { data: executions }, { data: employees }, { data: templates }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("created_at").returns<AutomationRule[]>(),
    supabase
      .from("automation_executions")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(500)
      .returns<AutomationExecution[]>(),
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase
      .from("automation_rule_templates")
      .select("*")
      .order("created_at")
      .returns<AutomationRuleTemplate[]>(),
  ]);

  return (
    <AutomationRulesManager
      rules={rules ?? []}
      executions={executions ?? []}
      employees={employees ?? []}
      templates={templates ?? []}
    />
  );
}
