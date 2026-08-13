import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { GearIcon } from "@/components/shared/icons";
import { OrganizationLogoUpload } from "@/components/dashboard/organization-logo-upload";
import { OrganizationSettingsForm } from "@/components/dashboard/organization-settings-form";
import { OrganizationHolidaysManager } from "@/components/dashboard/organization-holidays-manager";
import type { OrganizationHoliday } from "@/lib/types/organization";

export default async function OrganizationSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") redirect("/dashboard");

  const supabase = await createClient();
  const [organization, { data: holidaysRaw }] = await Promise.all([
    getCurrentOrganization(),
    supabase.from("organization_holidays").select("*").order("holiday_date").returns<OrganizationHoliday[]>(),
  ]);

  if (!organization) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-4.5">
      <PageHeader
        title="إعدادات المؤسسة"
        subtitle="الهوية، ساعات العمل، أيام العطل، والقيم الافتراضية للمهام"
        variant="navy"
        icon={<GearIcon className="h-6 w-6" />}
      />

      <div className="rounded-[18px] border border-border bg-surface p-6">
        <span className="mb-3 block text-sm font-medium text-foreground">شعار المؤسسة</span>
        <OrganizationLogoUpload logoUrl={organization.logo_url} orgName={organization.name} />
      </div>

      <OrganizationSettingsForm organization={organization} />

      <OrganizationHolidaysManager holidays={holidaysRaw ?? []} />
    </div>
  );
}
