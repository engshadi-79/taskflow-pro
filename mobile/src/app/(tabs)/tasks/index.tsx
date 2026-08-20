import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { MobileHeader } from "@/components/mobile-header";
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/mobile-theme";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  assignee: { full_name: string } | null;
};

const FILTERS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "new", label: "جديدة" },
  { key: "in_progress", label: "قيد التنفيذ" },
  { key: "pending_review", label: "بانتظار المراجعة" },
  { key: "completed", label: "مكتملة" },
  { key: "overdue", label: "متأخرة" },
];

export default function TasksScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const load = useCallback(async () => {
    if (!profile) return;
    let query = supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, assignee:users!tasks_assigned_to_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (profile.role === "employee") query = query.eq("assigned_to", profile.id);
    const { data } = await query.returns<Task[]>();
    setTasks(data ?? []);
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

  const filtered = useMemo(() => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)), [tasks, filter]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader title="المهام" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 flex-none px-4" contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 ${active ? "border-accent-600 bg-accent-600" : "border-border bg-surface"}`}
            >
              <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-muted"}`}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-8 text-center text-[13px] text-muted">لا توجد مهام</Text>}
          renderItem={({ item: task }) => (
            <TouchableOpacity onPress={() => router.push(`/tasks/${task.id}`)} className="rounded-[14px] bg-surface p-3.5 shadow">
              <View className="flex-row items-start justify-between gap-2">
                <Text numberOfLines={2} className="flex-1 text-[13.5px] font-bold text-foreground">
                  {task.title}
                </Text>
                <View className="rounded-full px-2 py-1" style={{ backgroundColor: STATUS_COLOR[task.status].bg }}>
                  <Text className="text-[10px] font-extrabold" style={{ color: STATUS_COLOR[task.status].text }}>
                    {STATUS_LABEL[task.status]}
                  </Text>
                </View>
              </View>
              <View className="mt-2 flex-row items-center gap-2">
                <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                <Text className="text-[11.5px] font-semibold" style={{ color: PRIORITY_COLOR[task.priority] }}>
                  {PRIORITY_LABEL[task.priority]}
                </Text>
                <Text className="text-[11.5px] font-semibold text-border">|</Text>
                <Text numberOfLines={1} className="flex-1 text-[11.5px] font-semibold text-muted">
                  {task.assignee?.full_name ?? "—"}
                </Text>
                <Text className="text-[11px] font-bold text-muted">{task.due_date ?? "بدون موعد"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
