import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { supabase } from "@/lib/supabase";
import { GRADIENT_PRIMARY, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/mobile-theme";

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled" | "archived";
type MilestoneStatus = "pending" | "in_progress" | "completed";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  due_date: string | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
};
type ProjectTask = { id: string; title: string; status: TaskStatus; assignee: { full_name: string } | null };
type Member = { id: string; user: { id: string; full_name: string } | null };
type Milestone = { id: string; title: string; due_date: string | null; status: MilestoneStatus };
type Stats = { total_count: number; completed_count: number; in_progress_count: number; overdue_count: number; completion_rate: number };

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "tasks", label: "المهام" },
  { key: "team", label: "الفريق" },
  { key: "milestones", label: "المراحل" },
] as const;

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "قيد التخطيط",
  active: "نشط",
  on_hold: "معلّق",
  completed: "مكتمل",
  cancelled: "ملغى",
  archived: "مؤرشف",
};
const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = { pending: "لم يبدأ", in_progress: "قيد التنفيذ", completed: "مكتمل" };
const MILESTONE_DOT: Record<MilestoneStatus, string> = { pending: "#94a3b8", in_progress: "#f97316", completed: "#22c55e" };

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<Stats>({ total_count: 0, completed_count: 0, in_progress_count: 0, overdue_count: 0, completion_rate: 0 });

  const load = useCallback(async () => {
    const [{ data: projectRow }, { data: taskRows }, { data: memberRows }, { data: milestoneRows }, { data: statsRows }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, status, priority, due_date, manager:users!projects_manager_id_fkey(full_name), department:departments(name)")
        .eq("id", id)
        .single<Project>(),
      supabase
        .from("tasks")
        .select("id, title, status, assignee:users!tasks_assigned_to_fkey(full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .returns<ProjectTask[]>(),
      supabase.from("project_members").select("id, user:users(id, full_name)").eq("project_id", id).returns<Member[]>(),
      supabase.from("project_milestones").select("id, title, due_date, status").eq("project_id", id).order("position", { ascending: true }).returns<Milestone[]>(),
      supabase.rpc("project_task_stats", { p_project_id: id }),
    ]);
    setProject(projectRow ?? null);
    setTasks(taskRows ?? []);
    setMembers(memberRows ?? []);
    setMilestones(milestoneRows ?? []);
    setStats((statsRows as Stats[] | null)?.[0] ?? { total_count: 0, completed_count: 0, in_progress_count: 0, overdue_count: 0, completion_rate: 0 });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !project) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        back
        gradient
        subtitle="تفاصيل المشروع"
        title={project.name}
        chips={
          <>
            <View className="rounded-full bg-white/90 px-2.5 py-1">
              <Text className="text-[11px] font-extrabold text-[#4f46c9]">{PROJECT_STATUS_LABEL[project.status]}</Text>
            </View>
            <View className="rounded-full bg-white/15 px-2.5 py-1">
              <Text className="text-[11px] font-extrabold text-white">أولوية {PRIORITY_LABEL[project.priority]}</Text>
            </View>
          </>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-none px-4 py-3" contentContainerStyle={{ gap: 8 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 ${active ? "bg-accent-600" : "bg-surface"}`}
            >
              <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-muted"}`}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1 px-4 pb-6" contentContainerStyle={{ gap: 10 }}>
        {tab === "overview" && (
          <View style={{ gap: 14 }}>
            <Text className="text-[13px] leading-6 text-muted">{project.description || "لا يوجد وصف"}</Text>
            <View className="flex-row flex-wrap gap-2.5">
              <StatTile label="إجمالي المهام" value={stats.total_count} />
              <StatTile label="المكتملة" value={stats.completed_count} color="#16a34a" />
              <StatTile label="قيد التنفيذ" value={stats.in_progress_count} color="#4338ca" />
              <StatTile label="المتأخرة" value={stats.overdue_count} color="#dc2626" />
            </View>
            <View className="rounded-[14px] bg-surface p-3.5 shadow">
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text className="text-[12.5px] font-bold text-foreground">نسبة الإنجاز</Text>
                <Text className="text-[12.5px] font-bold text-foreground">{stats.completion_rate}٪</Text>
              </View>
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <View className="h-full rounded-full bg-accent-500" style={{ width: `${stats.completion_rate}%` }} />
              </View>
            </View>
            <View className="gap-2 rounded-[14px] bg-surface p-3.5 shadow">
              <Row label="مدير المشروع" value={project.manager?.full_name ?? "—"} />
              <Row label="الموعد النهائي" value={project.due_date ?? "—"} />
              <Row label="القسم" value={project.department?.name ?? "على مستوى المؤسسة"} />
              <Row label="الأعضاء" value={String(members.length)} />
            </View>
          </View>
        )}

        {tab === "tasks" && (
          <View style={{ gap: 10 }}>
            {tasks.map((task) => (
              <TouchableOpacity key={task.id} onPress={() => router.push(`/tasks/${task.id}`)} className="rounded-[14px] bg-surface p-3.5 shadow">
                <View className="flex-row items-start justify-between gap-2">
                  <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-bold text-foreground">
                    {task.title}
                  </Text>
                  <View className="shrink-0 rounded-full px-2 py-1" style={{ backgroundColor: STATUS_COLOR[task.status].bg }}>
                    <Text className="text-[10px] font-extrabold" style={{ color: STATUS_COLOR[task.status].text }}>
                      {STATUS_LABEL[task.status]}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1.5 text-[11px] font-semibold text-muted">{task.assignee?.full_name ?? "—"}</Text>
              </TouchableOpacity>
            ))}
            {tasks.length === 0 && <Text className="py-8 text-center text-[13px] text-muted">لا توجد مهام لهذا المشروع</Text>}
          </View>
        )}

        {tab === "team" && (
          <View style={{ gap: 10 }}>
            {members.map((m) => (
              <View key={m.id} className="flex-row items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-600">
                  <Text className="text-[13px] font-extrabold text-white">{m.user?.full_name?.[0] ?? "—"}</Text>
                </View>
                <Text className="text-[13px] font-bold text-foreground">{m.user?.full_name ?? "—"}</Text>
              </View>
            ))}
            {members.length === 0 && <Text className="py-8 text-center text-[13px] text-muted">لا يوجد أعضاء في هذا المشروع</Text>}
          </View>
        )}

        {tab === "milestones" && (
          <View style={{ gap: 10 }}>
            {milestones.map((m) => (
              <View key={m.id} className="flex-row items-center gap-2.5 rounded-[14px] bg-surface p-3.5 shadow">
                <View className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: MILESTONE_DOT[m.status] }} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[13px] font-bold text-foreground">{m.title}</Text>
                  <Text className="mt-0.5 text-[11px] font-semibold text-muted">
                    {m.due_date ?? "بدون موعد"} — {MILESTONE_STATUS_LABEL[m.status]}
                  </Text>
                </View>
              </View>
            ))}
            {milestones.length === 0 && <Text className="py-8 text-center text-[13px] text-muted">لا توجد مراحل بعد</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatTile({ label, value, color = "#1a202c" }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ width: "47%" }} className="rounded-[14px] bg-surface p-3.5 shadow">
      <Text className="text-[19px] font-black" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-0.5 text-[11px] font-semibold text-muted">{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[12.5px] text-muted">{label}</Text>
      <Text className="text-[12.5px] font-bold text-foreground">{value}</Text>
    </View>
  );
}
