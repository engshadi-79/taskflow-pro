import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AlertIcon, CheckCircleIcon, PlusIcon, UsersIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";

const TYPE_LABEL: Record<string, string> = {
  general: "عام",
  reminder: "تذكير",
  announcement: "تعميم",
  warning: "تنبيه",
  urgent: "عاجل",
  meeting: "اجتماع",
  system: "نظام",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

const TARGET_LABEL: Record<string, string> = {
  specific: "موظفون محددون",
  department: "قسم",
  all: "جميع الموظفين",
};

type AdminNotificationRow = {
  id: string;
  title: string;
  type: string;
  priority: string;
  target_type: string;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
};

export default async function AdminNotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "employee") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_notifications")
    .select("id, title, type, priority, target_type, recipient_count, sent_at, created_at")
    .order("created_at", { ascending: false })
    .returns<AdminNotificationRow[]>();

  const rows = data ?? [];
  const totalRecipients = rows.reduce((sum, r) => sum + r.recipient_count, 0);
  const urgentCount = rows.filter((r) => r.priority === "urgent").length;

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="الإشعارات الإدارية"
        subtitle="إرسال تعميمات وتنبيهات للموظفين، وتتبّع من قرأها"
        variant="navy"
        icon={<AlertIcon className="h-6 w-6" />}
      >
        <Link
          href="/dashboard/admin-notifications/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" />
          إشعار جديد
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          value={rows.length}
          label="إجمالي الإشعارات المرسلة"
          tone="indigo"
          icon={<AlertIcon className="h-[22px] w-[22px]" />}
        />
        <StatCard
          value={totalRecipients}
          label="إجمالي المستلمين"
          tone="blue"
          icon={<UsersIcon className="h-[22px] w-[22px]" />}
        />
        <StatCard
          value={urgentCount}
          label="إشعارات عاجلة"
          tone="red"
          icon={<CheckCircleIcon className="h-[22px] w-[22px]" />}
        />
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-4 py-3 text-start">العنوان</th>
              <th className="px-4 py-3 text-start">النوع</th>
              <th className="px-4 py-3 text-start">الأولوية</th>
              <th className="px-4 py-3 text-start">المستهدفون</th>
              <th className="px-4 py-3 text-start">عدد المستلمين</th>
              <th className="px-4 py-3 text-start">تاريخ الإرسال</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admin-notifications/${row.id}`} className="font-bold text-foreground hover:text-accent-600">
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{TYPE_LABEL[row.type] ?? row.type}</td>
                <td className="px-4 py-3 text-muted">{PRIORITY_LABEL[row.priority] ?? row.priority}</td>
                <td className="px-4 py-3 text-muted">{TARGET_LABEL[row.target_type] ?? row.target_type}</td>
                <td className="px-4 py-3 text-muted">{row.recipient_count}</td>
                <td className="px-4 py-3 text-muted">{row.sent_at ? timeAgo(row.sent_at) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  لا توجد إشعارات إدارية بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
