import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
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
  const { data: policies } = await supabase
    .from("sla_policies")
    .select("*")
    .order("priority")
    .returns<SlaPolicy[]>();

  return <SlaPoliciesManager policies={policies ?? []} />;
}
