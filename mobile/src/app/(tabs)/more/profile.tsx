import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const ROLE_LABEL: Record<string, string> = { employee: "موظف", department_manager: "مدير قسم", super_admin: "مدير عام" };

export default function ProfileScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [latestScore, setLatestScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: department }, { count }, { data: evalRows }] = await Promise.all([
      profile.department_id
        ? supabase.from("departments").select("name").eq("id", profile.department_id).single<{ name: string }>()
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
    setDepartmentName(department?.name ?? null);
    setActiveTaskCount(count ?? 0);
    setLatestScore(evalRows?.[0]?.total_score ?? null);
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

        <View className="mb-4 flex-row gap-2.5">
          <View className="flex-1 items-center rounded-[14px] bg-surface p-3.5 shadow">
            <Text className="text-[19px] font-black text-teal-600">{latestScore !== null ? `${latestScore}%` : "—"}</Text>
            <Text className="mt-0.5 text-[10.5px] font-semibold text-muted">تقييم الأداء</Text>
          </View>
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
