import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getAllOrganizationsForOwner } from "@/lib/data/organization";
import { PLAN_LABEL } from "@/lib/plans";
import { PageHeader } from "@/components/shared/page-header";
import { BriefcaseIcon } from "@/components/shared/icons";

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

      <div className="overflow-x-auto rounded-[16px] border border-border bg-surface">
        <table className="w-full text-right text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-extrabold uppercase tracking-wide text-faint">
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">الخطة</th>
              <th className="px-4 py-3">الأعضاء</th>
              <th className="px-4 py-3">تاريخ التسجيل</th>
              <th className="px-4 py-3">طلب ترقية</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-bold text-foreground">{org.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      org.plan_type === "paid" ? "bg-green-50 text-green-700" : "bg-background text-muted"
                    }`}
                  >
                    {PLAN_LABEL[org.plan_type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{org.member_count}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(org.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  {org.pending_upgrade_request ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      يريد الترقية
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  لا توجد مؤسسات مسجّلة بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
