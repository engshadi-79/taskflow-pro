import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type LoadStatus = "low" | "normal" | "high" | "critical";
type WorkloadRow = {
  user_id: string;
  full_name: string;
  open_count: number;
  urgent_count: number;
  overdue_count: number;
  load_percent: number;
  load_status: LoadStatus;
};

const STATUS_LABEL: Record<LoadStatus, string> = { low: "منخفض", normal: "طبيعي", high: "مرتفع", critical: "حرج" };
const STATUS_BADGE: Record<LoadStatus, { bg: string; text: string }> = {
  low: { bg: "#ecfdf5", text: "#16a34a" },
  normal: { bg: "#eef2ff", text: "#4338ca" },
  high: { bg: "#fff7ed", text: "#ea580c" },
  critical: { bg: "#fef2f2", text: "#dc2626" },
};
const BAR_TONE: Record<LoadStatus, string> = { low: "#22c55e", normal: "#6366f1", high: "#f97316", critical: "#ef4444" };

export default function WorkloadScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile && profile.role === "employee") router.back();
  }, [profile, router]);

  const load = useCallback(async () => {
    if (!profile || profile.role === "employee") return;
    const departmentId = profile.role === "department_manager" ? profile.department_id : null;
    const { data } = await supabase.rpc("employee_workload", { p_department_id: departmentId });
    setRows((data as WorkloadRow[] | null) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!profile || profile.role === "employee") return null;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="الحمل الوظيفي" subtitle={`${rows.filter((r) => r.load_status === "critical").length} حالة حرجة`} />
      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-10 text-center text-[13px] text-muted">لا يوجد موظفون مطابقون</Text>}
          renderItem={({ item: row }) => (
            <View className="rounded-[14px] bg-surface p-3.5 shadow">
              <View className="flex-row items-center justify-between gap-2">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">
                  {row.full_name}
                </Text>
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_BADGE[row.load_status].bg }}>
                  <Text className="text-[10.5px] font-extrabold" style={{ color: STATUS_BADGE[row.load_status].text }}>
                    {STATUS_LABEL[row.load_status]}
                  </Text>
                </View>
              </View>
              <View className="mt-2.5 flex-row items-center gap-2">
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                  <View className="h-full rounded-full" style={{ width: `${row.load_percent}%`, backgroundColor: BAR_TONE[row.load_status] }} />
                </View>
                <Text className="text-[11.5px] font-bold text-muted">{row.load_percent}٪</Text>
              </View>
              <View className="mt-2.5 flex-row gap-3">
                <Text className="text-[11px] font-semibold text-muted">{row.open_count} مهمة مفتوحة</Text>
                {row.urgent_count > 0 && <Text className="text-[11px] font-semibold text-brand-red-500">{row.urgent_count} عاجلة</Text>}
                {row.overdue_count > 0 && <Text className="text-[11px] font-semibold text-brand-red-500">{row.overdue_count} متأخرة</Text>}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
