import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getEnabledFeatureKeys } from "@/lib/data/feature-flags";
import { can } from "@/lib/foundation/permissions";
import { listSavedTemplates } from "@/lib/actions/saved-templates";
import { TemplateConverter } from "@/components/dashboard/template-converter";

export default async function TemplateConverterPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!can.buildReports(profile)) {
    redirect("/dashboard/reports");
  }

  const enabledFeatures = await getEnabledFeatureKeys(profile.organization_id);
  if (!enabledFeatures.has("report_builder")) {
    redirect("/dashboard/reports");
  }

  const savedTemplates = await listSavedTemplates();

  return <TemplateConverter initialSavedTemplates={savedTemplates} />;
}
