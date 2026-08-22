import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { LockIcon } from "@/components/shared/icons";
import { PermissionMatrix } from "@/components/dashboard/permission-matrix";

export default async function PermissionsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Hard-coded, not can.manageOrganization() - see toggleRolePermission()
  // in src/lib/actions/permissions.ts for why this page can never be
  // gated by a permission the matrix it edits could itself revoke.
  if (profile.role !== "super_admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: permissions }, { data: rolePermissions }] = await Promise.all([
    supabase.from("permissions").select("key, label, category").order("category"),
    supabase.from("role_permissions").select("role, permission_key, scope"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4.5">
      <Link href="/dashboard/settings" className="text-[12.5px] font-bold text-accent-600 hover:underline">
        ← إعدادات المؤسسة
      </Link>

      <PageHeader
        title="مصفوفة الصلاحيات"
        subtitle="حدد ما يستطيع كل دور فعله في النظام دون الحاجة لتعديل الكود"
        variant="navy"
        icon={<LockIcon className="h-6 w-6" />}
      />

      <PermissionMatrix permissions={permissions ?? []} rolePermissions={rolePermissions ?? []} />
    </div>
  );
}
