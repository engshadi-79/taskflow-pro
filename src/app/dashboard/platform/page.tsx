import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getAllOrganizationsForOwner } from "@/lib/data/organization";
import { PageHeader } from "@/components/shared/page-header";
import { BriefcaseIcon } from "@/components/shared/icons";
import { PlatformOrganizationsManager } from "@/components/dashboard/platform-organizations-manager";

export default async function PlatformOrganizationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const result = await getAllOrganizationsForOwner();
  if ("error" in result) redirect("/dashboard");

  const organizations = result;

  return (
    <div className="mx-auto max-w-3xl space-y-4.5">
      <PageHeader
        title="مؤسسات منجز"
        subtitle="كل المؤسسات المسجّلة على المنصة - عرض خاص بمالك المنصة فقط"
        variant="navy"
        icon={<BriefcaseIcon className="h-6 w-6" />}
        count={`${organizations.length} مؤسسة`}
      />

      <PlatformOrganizationsManager organizations={organizations} />
    </div>
  );
}
