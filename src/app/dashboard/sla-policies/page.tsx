import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { SlaPoliciesManager } from "@/components/dashboard/sla-policies-manager";
import type { SlaPolicy } from "@/lib/types/sla";

export default async function SlaPoliciesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: policies }, organization] = await Promise.all([
    supabase.from("sla_policies").select("*").order("priority").returns<SlaPolicy[]>(),
    getCurrentOrganization(),
  ]);

  return (
    <SlaPoliciesManager
      policies={policies ?? []}
      defaultResolutionMinutes={organization ? organization.default_sla_hours * 60 : undefined}
    />
  );
}
