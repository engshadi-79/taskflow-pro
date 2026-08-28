import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const ROLE_LABEL: Record<string, string> = { employee: "موظف", department_manager: "مدير قسم", super_admin: "مدير عام" };

type Evaluation = {
  total_score: number | null;
  completion_score: number;
  on_time_score: number;
  quality_score: number;
  manager_evaluation_score: number | null;
};

const METRIC_COLOR = { accent: "#4f46e5", orange: "#d97706", green: "#16a34a", pink: "#db2777" } as const;

function MetricBar({ label, value, color }: { label: string; value: number | null; color: keyof typeof METRIC_COLOR }) {
  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[12px] font-bold text-foreground">{label}</Text>
        <Text className="text-[12px] font-bold" style={{ color: METRIC_COLOR[color] }}>
          {value !== null ? `${value}٪` : "—"}
        </Text>
      </View>
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-background">
        <View className="h-full rounded-full" style={{ width: `${value ?? 0}%`, backgroundColor: METRIC_COLOR[color] }} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: department }, { count }, { data: evalRows }] = await Promise.all([
      profile.department_id
        ? supabase.from("departments").select("name").eq("id", profile.department_id).single<{ name: string }>()
        : Promise.resolve({ data: null }),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", profile.id).not("status", "in", "(completed,cancelled)"),
      supabase
        .from("employee_kpi_evaluations")
        .select("total_score, completion_score, on_time_score, quality_score, manager_evaluation_score")
        .eq("user_id", profile.id)
        .eq("status", "finalized")
        .order("period_end", { ascending: false })
        .limit(1)
        .returns<Evaluation[]>(),
    ]);
    setDepartmentName(department?.name ?? null);
    setActiveTaskCount(count ?? 0);
    setEvaluation(evalRows?.[0] ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="الملف الشخصي" />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5 items-center gap-2">
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-accent-600">
            <Text className="text-[28px] font-extrabold text-white">{profile.full_name[0]}</Text>
          </View>
          <Text className="text-[16px] font-extrabold text-foreground">{profile.full_name}</Text>
          <View className="rounded-full bg-accent-50 px-3 py-1">
            <Text className="text-[12px] font-bold text-accent-600">{ROLE_LABEL[profile.role] ?? profile.role}</Text>
          </View>
        </View>

        <View className="mb-4 items-center rounded-[18px] bg-surface p-5 shadow">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-50">
            <Text className="text-[24px] font-black text-accent-600">
              {evaluation?.total_score !== null && evaluation?.total_score !== undefined ? Math.round(evaluation.total_score) : "—"}
            </Text>
          </View>
          <Text className="mt-2 text-[12px] font-bold text-muted">التقييم الإجمالي</Text>
        </View>

        {evaluation ? (
          <View className="mb-4 gap-3 rounded-[14px] bg-surface p-3.5 shadow">
            <MetricBar label="الإنجاز" value={evaluation.completion_score} color="accent" />
            <MetricBar label="الالتزام بالوقت" value={evaluation.on_time_score} color="orange" />
            <MetricBar label="الجودة" value={evaluation.quality_score} color="green" />
            <MetricBar label="تقييم المدير" value={evaluation.manager_evaluation_score} color="pink" />
          </View>
        ) : (
          <Text className="mb-4 text-center text-[12.5px] text-muted">لا يوجد تقييم أداء معتمد بعد</Text>
        )}

        <View className="mb-4 flex-row gap-2.5">
          <View className="flex-1 items-center rounded-[14px] bg-surface p-3.5 shadow">
            <Text className="text-[19px] font-black text-accent-600">{activeTaskCount}</Text>
            <Text className="mt-0.5 text-[10.5px] font-semibold text-muted">مهمة نشطة</Text>
          </View>
        </View>

        <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">بيانات التواصل</Text>
        <View className="rounded-[14px] bg-surface px-3.5 shadow">
          <View className="flex-row justify-between border-b border-border py-3">
            <Text className="text-[12.5px] text-muted">القسم</Text>
            <Text className="text-[12.5px] font-bold text-foreground">{departmentName ?? "—"}</Text>
          </View>
          <View className="flex-row justify-between py-3">
            <Text className="text-[12.5px] text-muted">البريد الإلكتروني</Text>
            <Text className="text-[12.5px] font-bold text-foreground">{profile.email}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
