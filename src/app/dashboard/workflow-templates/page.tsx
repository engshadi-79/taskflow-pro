import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { WorkflowTemplatesManager } from "@/components/dashboard/workflow-templates-manager";
import type { WorkflowStep, WorkflowTemplate } from "@/lib/types/workflow";

export default async function WorkflowTemplatesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: templates }, { data: steps }, { data: employees }] = await Promise.all([
    supabase.from("workflow_templates").select("*").order("created_at").returns<WorkflowTemplate[]>(),
    supabase.from("workflow_steps").select("*").order("position").returns<WorkflowStep[]>(),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  const stepsByTemplate: Record<string, WorkflowStep[]> = {};
  for (const step of steps ?? []) {
    stepsByTemplate[step.template_id] = [...(stepsByTemplate[step.template_id] ?? []), step];
  }

  return (
    <WorkflowTemplatesManager
      templates={templates ?? []}
      stepsByTemplate={stepsByTemplate}
      employees={employees ?? []}
    />
  );
}
