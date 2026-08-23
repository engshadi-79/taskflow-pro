import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { ExcelConverter } from "@/components/dashboard/excel-converter";

export default async function ExcelConverterPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!can.buildReports(profile)) {
    redirect("/dashboard/reports");
  }

  return <ExcelConverter />;
}
