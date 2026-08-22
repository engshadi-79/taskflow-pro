import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AlertIcon, CheckCircleIcon, ClockIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";
import { CancelScheduledNotificationButton } from "@/components/dashboard/cancel-scheduled-notification-button";

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

export default async function AdminNotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "employee") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: notification } = await supabase.from("admin_notifications").select("*").eq("id", id).single();
  if (!notification) notFound();

  const isPending = notification.status === "scheduled";
  const isCancelled = notification.status === "cancelled";

  const [{ data: statsRaw }, { data: recipientsRaw }] = isPending || isCancelled
    ? [{ data: null }, { data: null }]
    : await Promise.all([
        supabase.rpc("admin_notification_stats", { p_notification_id: id }),
        supabase.rpc("admin_notification_recipients", { p_notification_id: id }),
      ]);

  const stats = (statsRaw as { recipient_count: number; read_count: number }[] | null)?.[0] ?? {
    recipient_count: 0,
    read_count: 0,
  };
  const recipients =
    (recipientsRaw as { user_id: string; full_name: string; is_read: boolean; read_at: string | null }[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4.5">
      <Link href="/dashboard/admin-notifications" className="text-[12.5px] font-bold text-accent-600 hover:underline">
        ← جميع الإشعارات الإدارية
      </Link>

      <PageHeader title={notification.title} subtitle={notification.message} variant="navy" icon={<AlertIcon className="h-6 w-6" />} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[14px] border border-border bg-surface p-3 text-center">
          <div className="text-[11px] text-faint">النوع</div>
          <div className="mt-1 font-bold text-foreground">{TYPE_LABEL[notification.type] ?? notification.type}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-surface p-3 text-center">
          <div className="text-[11px] text-faint">الأولوية</div>
          <div className="mt-1 font-bold text-foreground">{PRIORITY_LABEL[notification.priority] ?? notification.priority}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-surface p-3 text-center">
          <div className="text-[11px] text-faint">المستهدفون</div>
          <div className="mt-1 font-bold text-foreground">{TARGET_LABEL[notification.target_type] ?? notification.target_type}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-surface p-3 text-center">
          <div className="text-[11px] text-faint">{isPending ? "موعد الإرسال" : "تاريخ الإرسال"}</div>
          <div className="mt-1 font-bold text-foreground">
            {isPending && notification.scheduled_at
              ? new Date(notification.scheduled_at).toLocaleString("ar")
              : notification.sent_at
                ? timeAgo(notification.sent_at)
                : "—"}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="rounded-[18px] border border-blue-200 bg-blue-50 p-5">
          <p className="mb-3 text-[13.5px] font-extrabold text-blue-800">
            هذا الإشعار مجدول ولم يُرسل بعد إلى {notification.recipient_count} موظف
          </p>
          <CancelScheduledNotificationButton notificationId={notification.id} />
        </div>
      )}

      {isCancelled && (
        <div className="rounded-[18px] border border-red-200 bg-red-50 p-5">
          <p className="text-[13.5px] font-extrabold text-red-700">تم إلغاء هذا الإشعار قبل إرساله</p>
        </div>
      )}

      {!isPending && !isCancelled && (
        <div className="rounded-[18px] border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <span className="text-[14px] font-extrabold text-foreground">
                تمت القراءة: {stats.read_count} / {stats.recipient_count}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-orange-500" />
              <span className="text-[13px] text-muted">لم يقرأ: {stats.recipient_count - stats.read_count}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="px-3 py-2 text-start">الموظف</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                  <th className="px-3 py-2 text-start">وقت القراءة</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.user_id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{r.full_name}</td>
                    <td className="px-3 py-2">
                      {r.is_read ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11.5px] font-bold text-green-600">قرأ</span>
                      ) : (
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11.5px] font-bold text-orange-600">لم يقرأ</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{r.read_at ? timeAgo(r.read_at) : "—"}</td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted">
                      لا يوجد مستلمون
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
