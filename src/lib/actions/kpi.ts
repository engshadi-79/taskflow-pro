"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";

export type KpiFormState = { error?: string };

export async function createEmployeeKpiEvaluation(
  _prevState: KpiFormState,
  formData: FormData
): Promise<KpiFormState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "department_manager")) {
    return { error: "غير مصرح لك بإنشاء تقييم أداء" };
  }

  const userId = formData.get("user_id") as string;
  const periodStart = formData.get("period_start") as string;
  const periodEnd = formData.get("period_end") as string;

  if (!userId) return { error: "اختر موظفًا" };
  if (!periodStart || !periodEnd) return { error: "حدد فترة التقييم" };
  if (periodEnd < periodStart) return { error: "نهاية الفترة يجب أن تكون بعد بدايتها" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_employee_kpi_evaluation", {
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) {
    if (error.code === "23505") return { error: "يوجد تقييم لهذا الموظف بنفس الفترة مسبقًا" };
    return { error: error.message || "تعذر إنشاء التقييم" };
  }

  revalidatePath("/dashboard/performance");
  return {};
}

export async function finalizeEmployeeKpiEvaluation(
  evaluationId: string,
  _prevState: KpiFormState,
  formData: FormData
): Promise<KpiFormState> {
  const score = Number(formData.get("manager_evaluation_score"));
  const note = (formData.get("manager_note") as string)?.trim() || null;

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return { error: "تقييم المدير يجب أن يكون رقمًا بين 0 و100" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_employee_kpi_evaluation", {
    p_evaluation_id: evaluationId,
    p_manager_evaluation_score: score,
    p_manager_note: note,
  });

  if (error) return { error: error.message || "تعذر اعتماد التقييم" };

  revalidatePath("/dashboard/performance");
  return {};
}
