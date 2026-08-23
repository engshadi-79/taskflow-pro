import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { TemplateConverter } from "@/components/dashboard/template-converter";

export default async function TemplateConverterPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!can.buildReports(profile)) {
    redirect("/dashboard/reports");
  }

  return <TemplateConverter />;
}
