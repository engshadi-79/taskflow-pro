import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { STATUS_COLOR, STATUS_LABEL, type TaskStatus } from "@/lib/mobile-theme";

type StatusBreakdownRow = { status: TaskStatus; task_count: number };
type KpiEvaluation = {
  completion_score: number;
  on_time_score: number;
  quality_score: number;
  manager_evaluation_score: number | null;
  total_score: number | null;
};

const KPI_WEIGHTS = { completion: 0.3, on_time: 0.25, quality: 0.25, manager_evaluation: 0.2 };

export default function ReportsScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"reports" | "performance">("reports");
  const [loading, setLoading] = useState(true);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdownRow[]>([]);
  const [latestEval, setLatestEval] = useState<KpiEvaluation | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    if (tab === "reports") {
      const { data } = await supabase.rpc("report_status_breakdown");
      setStatusBreakdown((data as StatusBreakdownRow[] | null) ?? []);
    } else {
      const { data } = await supabase
        .from("employee_kpi_evaluations")
        .select("completion_score, on_time_score, quality_score, manager_evaluation_score, total_score")
        .eq("user_id", profile.id)
        .eq("status", "finalized")
        .order("period_end", { ascending: false })
        .limit(1)
        .returns<KpiEvaluation[]>();
      setLatestEval(data?.[0] ?? null);
    }
    setLoading(false);
  }, [profile, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const maxCount = Math.max(1, ...statusBreakdown.map((r) => r.task_count));
  const kpiBreakdown = latestEval
    ? [
        { label: `نسبة الإنجاز (${KPI_WEIGHTS.completion * 100}%)`, value: latestEval.completion_score },
        { label: `الالتزام بالوقت (${KPI_WEIGHTS.on_time * 100}%)`, value: latestEval.on_time_score },
        { label: `الجودة (${KPI_WEIGHTS.quality * 100}%)`, value: latestEval.quality_score },
        { label: `تقييم المدير (${KPI_WEIGHTS.manager_evaluation * 100}%)`, value: latestEval.manager_evaluation_score ?? 0 },
      ]
    : [];

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="التقارير والأداء" />
      <View className="px-4">
        <View className="mb-4 flex-row rounded-[12px] bg-background p-1">
          <TouchableOpacity onPress={() => setTab("reports")} className={`flex-1 items-center rounded-[9px] py-2 ${tab === "reports" ? "bg-accent-600" : ""}`}>
            <Text className={`text-[12.5px] font-bold ${tab === "reports" ? "text-white" : "text-muted"}`}>التقارير</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("performance")}
            className={`flex-1 items-center rounded-[9px] py-2 ${tab === "performance" ? "bg-accent-600" : ""}`}
          >
            <Text className={`text-[12.5px] font-bold ${tab === "performance" ? "text-white" : "text-muted"}`}>الأداء</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
          {tab === "reports" ? (
            <View className="rounded-[14px] bg-surface p-3.5 shadow">
              <Text className="mb-3 text-[12.5px] font-extrabold text-foreground">توزيع المهام حسب الحالة</Text>
              {statusBreakdown.length === 0 ? (
                <Text className="py-6 text-center text-[12.5px] text-muted">لا توجد بيانات كافية بعد</Text>
              ) : (
                <View className="h-[90px] flex-row items-end gap-2.5">
                  {statusBreakdown.map((r) => (
                    <View key={r.status} className="flex-1 items-center justify-end gap-1.5">
                      <View
                        className="w-full rounded-t-[6px]"
                        style={{ height: `${Math.max(15, (r.task_count / maxCount) * 100)}%`, backgroundColor: STATUS_COLOR[r.status].dot }}
                      />
                      <Text className="text-[9.5px] font-bold text-muted">{STATUS_LABEL[r.status].split(" ")[0]}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View className="items-center rounded-[14px] bg-surface p-4 shadow">
                <Text className="text-[30px] font-black text-accent-600">{latestEval?.total_score ?? "—"}</Text>
                <Text className="mt-0.5 text-[11.5px] font-semibold text-muted">التقييم الإجمالي (KPI)</Text>
              </View>
              {kpiBreakdown.map((k) => (
                <View key={k.label}>
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="text-[12px] font-bold text-foreground">{k.label}</Text>
                    <Text className="text-[12px] font-bold text-foreground">{k.value}%</Text>
                  </View>
                  <View className="h-1.5 overflow-hidden rounded-full bg-background">
                    <View className="h-full rounded-full bg-accent-500" style={{ width: `${k.value}%` }} />
                  </View>
                </View>
              ))}
              {!latestEval && <Text className="text-center text-[12.5px] text-muted">لا توجد تقييمات معتمَدة بعد</Text>}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
