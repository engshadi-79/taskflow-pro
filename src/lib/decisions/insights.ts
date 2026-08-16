import type { SupabaseClient } from "@supabase/supabase-js";
import { pctDelta } from "@/lib/report-periods";
import type { Insight } from "@/lib/types/decisions";

type PeriodWindow = { since: Date; until: Date; prevSince: Date; prevUntil: Date };

// Minimum change (percentage points, or percent for the hours comparison)
// worth surfacing at all - smaller wobbles are noise, not a decision.
const NOTABLE_DELTA = 5;
const CRITICAL_DELTA = 15;

/**
 * Computes the "ماذا حدث / لماذا / ما الإجراء" cards for the Executive
 * Decision Center. Every number here comes from an existing report or
 * sla_report RPC called twice (current vs previous period, via the same
 * periodRange() used by /dashboard/reports) - no new scoring model, no
 * invented risk index. p_department_id scopes everything to one department
 * for a department_manager, or leaves it org-wide (null) for a super_admin.
 */
export async function computeExecutiveInsights(
  supabase: SupabaseClient,
  window: PeriodWindow,
  departmentId: string | null
): Promise<Insight[]> {
  const sinceIso = window.since.toISOString();
  const untilIso = window.until.toISOString();
  const prevSinceIso = window.prevSince.toISOString();
  const prevUntilIso = window.prevUntil.toISOString();

  const [
    { data: delayNowRaw },
    { data: delayPrevRaw },
    { data: hoursNowRaw },
    { data: hoursPrevRaw },
    { data: slaNowRaw },
    { data: slaPrevRaw },
    { data: rejectionNowRaw },
    { data: rejectionPrevRaw },
    { data: overdueByDeptRaw },
  ] = await Promise.all([
    supabase.rpc("report_delay_rate", { p_since: sinceIso, p_until: untilIso, p_department_id: departmentId }),
    supabase.rpc("report_delay_rate", { p_since: prevSinceIso, p_until: prevUntilIso, p_department_id: departmentId }),
    supabase.rpc("report_avg_completion_hours", { p_since: sinceIso, p_until: untilIso, p_department_id: departmentId }),
    supabase.rpc("report_avg_completion_hours", { p_since: prevSinceIso, p_until: prevUntilIso, p_department_id: departmentId }),
    supabase.rpc("sla_report", { p_department_id: departmentId, p_user_id: null, p_since: sinceIso, p_until: untilIso }),
    supabase.rpc("sla_report", { p_department_id: departmentId, p_user_id: null, p_since: prevSinceIso, p_until: prevUntilIso }),
    supabase.rpc("report_review_rejection_rate", { p_since: sinceIso, p_until: untilIso, p_department_id: departmentId }),
    supabase.rpc("report_review_rejection_rate", { p_since: prevSinceIso, p_until: prevUntilIso, p_department_id: departmentId }),
    supabase.rpc("report_overdue_by_department"),
  ]);

  const insights: Insight[] = [];

  const delayCur = (delayNowRaw as number | null) ?? 0;
  const delayPrv = (delayPrevRaw as number | null) ?? 0;
  if (Math.abs(delayCur - delayPrv) >= NOTABLE_DELTA) {
    const worse = delayCur > delayPrv;
    insights.push({
      id: "delay-rate",
      severity: worse ? (delayCur - delayPrv >= CRITICAL_DELTA ? "critical" : "warning") : "good",
      title: worse ? "ارتفعت نسبة التأخير" : "تحسّنت نسبة التأخير",
      explanation: `نسبة المهام المتأخرة كانت ${delayPrv}٪ وأصبحت ${delayCur}٪ مقارنة بالفترة السابقة.`,
      action_label: "مراجعة المهام المتأخرة",
      action_href: "/dashboard/reports",
    });
  }

  const hoursCur = hoursNowRaw as number | null;
  const hoursPrv = hoursPrevRaw as number | null;
  if (hoursCur !== null && hoursPrv !== null && hoursPrv > 0) {
    const pct = pctDelta(hoursCur, hoursPrv);
    if (Math.abs(pct) >= NOTABLE_DELTA) {
      const worse = pct > 0;
      insights.push({
        id: "avg-completion",
        severity: worse ? (pct >= 30 ? "critical" : "warning") : "good",
        title: worse ? "أصبحت المهام تستغرق وقتًا أطول لإنجازها" : "تسريع في إنجاز المهام",
        explanation: `متوسط وقت إنجاز المهمة كان ${hoursPrv} ساعة وأصبح ${hoursCur} ساعة (${pct > 0 ? "+" : ""}${pct}٪).`,
        action_label: "عرض تقرير الأداء",
        action_href: "/dashboard/reports",
      });
    }
  }

  const slaCur = (slaNowRaw as { compliance_rate: number }[] | null)?.[0];
  const slaPrv = (slaPrevRaw as { compliance_rate: number }[] | null)?.[0];
  if (slaCur && slaPrv) {
    const diff = slaCur.compliance_rate - slaPrv.compliance_rate;
    if (Math.abs(diff) >= NOTABLE_DELTA) {
      const worse = diff < 0;
      insights.push({
        id: "sla-compliance",
        severity: worse ? (Math.abs(diff) >= CRITICAL_DELTA ? "critical" : "warning") : "good",
        title: worse ? "تراجع الالتزام باتفاقية مستوى الخدمة" : "تحسّن الالتزام باتفاقية مستوى الخدمة",
        explanation: `نسبة الالتزام بـ SLA كانت ${slaPrv.compliance_rate}٪ وأصبحت ${slaCur.compliance_rate}٪.`,
        action_label: "عرض تقرير SLA",
        action_href: "/dashboard/sla-report",
      });
    }
  }

  const rejCur = (rejectionNowRaw as { total_reviews: number; rejection_rate: number }[] | null)?.[0];
  const rejPrv = (rejectionPrevRaw as { total_reviews: number; rejection_rate: number }[] | null)?.[0];
  if (rejCur && rejPrv && rejCur.total_reviews > 0 && rejPrv.total_reviews > 0) {
    const diff = rejCur.rejection_rate - rejPrv.rejection_rate;
    if (Math.abs(diff) >= NOTABLE_DELTA) {
      const worse = diff > 0;
      insights.push({
        id: "review-rejection",
        severity: worse ? (diff >= CRITICAL_DELTA ? "critical" : "warning") : "good",
        title: worse ? "ارتفع معدل رفض المراجعة" : "تحسّن معدل قبول المراجعة",
        explanation: `نسبة رفض المهام عند المراجعة كانت ${rejPrv.rejection_rate}٪ وأصبحت ${rejCur.rejection_rate}٪.`,
        action_label: "عرض تقييمات الأداء",
        action_href: "/dashboard/performance",
      });
    }
  }

  const deptRows = (
    (overdueByDeptRaw as { department_id: string; department_name: string; overdue_count: number }[]) ?? []
  )
    .filter((r) => !departmentId || r.department_id === departmentId)
    .filter((r) => r.overdue_count > 0)
    .sort((a, b) => b.overdue_count - a.overdue_count);

  if (deptRows[0]) {
    const top = deptRows[0];
    insights.push({
      id: "top-overdue-department",
      severity: top.overdue_count >= 10 ? "critical" : "warning",
      title: `تراكم مهام متأخرة: ${top.department_name}`,
      explanation: `${top.overdue_count} مهمة متأخرة حاليًا ضمن هذا القسم.`,
      action_label: "عرض المهام المتأخرة",
      action_href: "/dashboard/reports",
    });
  }

  return insights;
}
