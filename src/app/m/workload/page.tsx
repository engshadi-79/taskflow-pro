import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { LOAD_STATUS_LABEL, type WorkloadRow } from "@/lib/types/workload";

const STATUS_BADGE: Record<string, string> = {
  low: "bg-green-50 text-green-600",
  normal: "bg-accent-50 text-accent-700",
  high: "bg-orange-50 text-orange-600",
  critical: "bg-brand-red-50 text-brand-red-500",
};

const BAR_TONE: Record<string, string> = {
  low: "bg-green-500",
  normal: "bg-accent-500",
  high: "bg-orange-500",
  critical: "bg-brand-red-500",
};

export default async function MobileWorkloadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin" && profile.role !== "department_manager") redirect("/m");

  const supabase = await createClient();
  const departmentId = profile.role === "department_manager" ? profile.department_id : null;
  const { data: workload } = await supabase.rpc("employee_workload", { p_department_id: departmentId });
  const rows = (workload as WorkloadRow[] | null) ?? [];

  return (
    <div>
      <MobileHeader title="الحمل الوظيفي" subtitle={`${rows.filter((r) => r.load_status === "critical").length} حالة حرجة`} />
      <div className="flex flex-col gap-2.5 px-4 pb-6">
        {rows.map((row) => (
          <div key={row.user_id} className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-foreground">{row.full_name}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${STATUS_BADGE[row.load_status]}`}>
                {LOAD_STATUS_LABEL[row.load_status]}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                <div className={`h-full rounded-full ${BAR_TONE[row.load_status]}`} style={{ width: `${row.load_percent}%` }} />
              </div>
              <span className="text-[11.5px] font-bold text-muted">{row.load_percent}٪</span>
            </div>
            <div className="mt-2.5 flex gap-3 text-[11px] font-semibold text-muted">
              <span>{row.open_count} مهمة مفتوحة</span>
              {row.urgent_count > 0 && <span className="text-brand-red-500">{row.urgent_count} عاجلة</span>}
              {row.overdue_count > 0 && <span className="text-brand-red-500">{row.overdue_count} متأخرة</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-10 text-center text-[13px] text-muted">لا يوجد موظفون مطابقون</p>}
      </div>
    </div>
  );
}
