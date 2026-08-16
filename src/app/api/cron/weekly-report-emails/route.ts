import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailShell, getAppUrl } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type RecipientUser = {
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
  department_id: string | null;
};

type RecipientRow = { user_id: string; users: RecipientUser | RecipientUser[] | null };

type WeeklySummary = {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  delay_rate: number;
  avg_completion_hours: number | null;
  sla_compliance_rate: number;
};

const METRIC_ROWS: { key: keyof WeeklySummary; label: string; suffix?: string }[] = [
  { key: "total_tasks", label: "إجمالي المهام" },
  { key: "completed_tasks", label: "المهام المنجزة" },
  { key: "overdue_tasks", label: "المهام المتأخرة" },
  { key: "delay_rate", label: "نسبة التأخير", suffix: "٪" },
  { key: "avg_completion_hours", label: "متوسط وقت الإنجاز", suffix: " ساعة" },
  { key: "sla_compliance_rate", label: "الالتزام بـ SLA", suffix: "٪" },
];

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: recipients, error } = await supabase
    .from("user_notification_preferences")
    .select("user_id, users(email, full_name, role, organization_id, department_id)")
    .eq("weekly_report_email_enabled", true)
    .returns<RecipientRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of recipients ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!user || (user.role !== "super_admin" && user.role !== "department_manager")) continue;

    const departmentId = user.role === "department_manager" ? user.department_id : null;

    // report_weekly_email_summary() is SECURITY DEFINER, revoked from
    // anon/authenticated, service_role-only - safe to call here with a
    // caller-supplied organization_id precisely because this route only
    // ever reaches it via the CRON_SECRET-gated service-role client.
    const { data: summaryRows, error: summaryError } = await supabase.rpc("report_weekly_email_summary", {
      p_organization_id: user.organization_id,
      p_department_id: departmentId,
    });

    const summary = (summaryRows as WeeklySummary[] | null)?.[0];
    if (summaryError || !summary) {
      failed++;
      console.error(`[cron:weekly-report-emails] summary failed for ${row.user_id}:`, summaryError?.message);
      continue;
    }

    const rowsHtml = METRIC_ROWS.map(
      (m) =>
        `<tr><td style="padding:6px 0;color:#6b7280;">${m.label}</td><td style="padding:6px 0;font-weight:bold;color:#111827;">${
          summary[m.key] ?? "—"
        }${m.suffix ?? ""}</td></tr>`
    ).join("");

    const html = emailShell(
      "تقريرك الأسبوعي",
      `<p style="font-size: 14px; color: #374151; line-height: 1.7;">مرحبًا ${user.full_name}، إليك أداء آخر 7 أيام:</p>
       <table style="width:100%; border-collapse:collapse; font-size:13px;">${rowsHtml}</table>`,
      `${getAppUrl()}/dashboard/reports`,
      "عرض التقرير الكامل"
    );

    const result = await sendEmail({ to: user.email, subject: "تقريرك الأسبوعي — منجز", html });
    if (result.error) {
      failed++;
      console.error(`[cron:weekly-report-emails] send failed for ${row.user_id}:`, result.error);
      continue;
    }

    sent++;
    await supabase
      .from("user_notification_preferences")
      .update({ last_weekly_report_email_at: new Date().toISOString() })
      .eq("user_id", row.user_id);
  }

  return NextResponse.json({ sent, failed, checked: recipients?.length ?? 0 });
}
