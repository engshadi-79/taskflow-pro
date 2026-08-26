import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getEnabledFeatureKeys } from "@/lib/data/feature-flags";
import { can } from "@/lib/foundation/permissions";
import { listReportDefinitions } from "@/lib/actions/report-builder";
import { ReportBuilder } from "@/components/dashboard/report-builder";

export default async function ReportBuilderPage() {
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

  const savedReports = await listReportDefinitions();

  return <ReportBuilder initialSavedReports={savedReports} />;
}
