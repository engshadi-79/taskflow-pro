import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";

const ROLE_LABEL: Record<string, string> = { employee: "موظف", department_manager: "مدير قسم", super_admin: "مدير عام" };

export default async function MobileProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: department }, { count: activeTaskCount }, { data: evalRows }] = await Promise.all([
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", profile.id).not("status", "in", "(completed,cancelled)"),
    supabase
      .from("employee_kpi_evaluations")
      .select("total_score")
      .eq("user_id", profile.id)
      .eq("status", "finalized")
      .order("period_end", { ascending: false })
      .limit(1)
      .returns<{ total_score: number | null }[]>(),
  ]);

  const latestScore = evalRows?.[0]?.total_score ?? null;

  return (
    <div>
      <MobileHeader title="الملف الشخصي" />
      <div className="px-4 pb-6">
        <div className="mb-5 flex flex-col items-center gap-2">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[28px] font-extrabold text-white">
            {profile.full_name[0]}
          </span>
          <div className="text-[16px] font-extrabold text-foreground">{profile.full_name}</div>
          <span className="rounded-full bg-accent-50 px-3 py-1 text-[12px] font-bold text-accent-600">{ROLE_LABEL[profile.role] ?? profile.role}</span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[14px] bg-surface p-3.5 text-center shadow-[0_4px_12px_rgba(30,41,59,.06)]">
            <div className="text-[19px] font-black text-teal-600">{latestScore !== null ? `${latestScore}%` : "—"}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold text-muted">تقييم الأداء</div>
          </div>
          <div className="rounded-[14px] bg-surface p-3.5 text-center shadow-[0_4px_12px_rgba(30,41,59,.06)]">
            <div className="text-[19px] font-black text-accent-600">{activeTaskCount ?? 0}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold text-muted">مهمة نشطة</div>
          </div>
        </div>

        <div className="mb-2.5 text-[13px] font-extrabold text-foreground">بيانات التواصل</div>
        <div className="rounded-[14px] bg-surface px-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
          <div className="flex justify-between border-b border-border py-3 text-[12.5px]">
            <span className="text-muted">القسم</span>
            <span className="font-bold text-foreground">{(department as { name: string } | null)?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between py-3 text-[12.5px]">
            <span className="text-muted">البريد الإلكتروني</span>
            <span className="font-bold text-foreground">{profile.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
