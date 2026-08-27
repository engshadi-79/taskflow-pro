import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { FolderIcon } from "@/components/tab-icons";
import { supabase } from "@/lib/supabase";

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled" | "archived";
type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  due_date: string | null;
  manager: { full_name: string } | null;
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "قيد التخطيط",
  active: "نشط",
  on_hold: "معلّق",
  completed: "مكتمل",
  cancelled: "ملغى",
  archived: "مؤرشف",
};
const STATUS_BADGE: Record<ProjectStatus, { bg: string; text: string }> = {
  planning: { bg: "#e2e8f0", text: "#1a202c" },
  active: { bg: "#eef2ff", text: "#4338ca" },
  on_hold: { bg: "#fff7ed", text: "#ea580c" },
  completed: { bg: "#ecfdf5", text: "#16a34a" },
  cancelled: { bg: "#e2e8f0", text: "#94a3b8" },
  archived: { bg: "#e2e8f0", text: "#94a3b8" },
};

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: projectRows } = await supabase
      .from("projects")
      .select("id, name, status, due_date, manager:users!projects_manager_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .returns<Project[]>();
    setProjects(projectRows ?? []);

    const ids = (projectRows ?? []).map((p) => p.id);
    const { data: tasks } = ids.length
      ? await supabase.from("tasks").select("project_id, status").in("project_id", ids).neq("status", "cancelled")
      : { data: [] };
    const byProject: Record<string, { total: number; completed: number }> = {};
    for (const t of tasks ?? []) {
      if (!t.project_id) continue;
      const s = byProject[t.project_id] ?? { total: 0, completed: 0 };
      s.total += 1;
      if (t.status === "completed") s.completed += 1;
      byProject[t.project_id] = s;
    }
    setStats(byProject);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="المشاريع" subtitle={`${projects.length} مشروع`} />
      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-10 text-center text-[13px] text-muted">لا توجد مشاريع بعد</Text>}
          renderItem={({ item: project }) => {
            const s = stats[project.id] ?? { total: 0, completed: 0 };
            const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            return (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/more/projects/[id]", params: { id: project.id } })}
                className="flex-row items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow"
              >
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50">
                  <FolderIcon color="#db2777" size={18} />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">
                      {project.name}
                    </Text>
                    <View className="shrink-0 rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_BADGE[project.status].bg }}>
                      <Text className="text-[10.5px] font-extrabold" style={{ color: STATUS_BADGE[project.status].text }}>
                        {STATUS_LABEL[project.status]}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                    <View className="h-full rounded-full bg-accent-500" style={{ width: `${rate}%` }} />
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-[11.5px] font-semibold text-muted">{project.manager?.full_name ?? "بدون مدير"}</Text>
                    <Text className="text-[11.5px] font-semibold text-muted">{project.due_date ?? "—"}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
