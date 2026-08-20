import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { MobileHeader } from "@/components/mobile-header";
import { PRIORITY_COLOR, STATUS_COLOR, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/mobile-theme";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string;
  assignee: { full_name: string } | null;
};

const COLUMN_STATUSES: TaskStatus[] = ["new", "in_progress", "pending_review", "completed", "overdue"];

export default function KanbanScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, priority, assigned_to, assignee:users!tasks_assigned_to_fkey(full_name)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<Task[]>();
    setTasks(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = profile?.role === "super_admin" || profile?.role === "department_manager";

  async function handleMove(status: TaskStatus) {
    if (!moveTask || !profile) return;
    const canMove = canManage || moveTask.assigned_to === profile.id;
    if (!canMove) {
      setError("غير مصرح لك بتحديث هذه المهمة");
      setMoveTask(null);
      return;
    }
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === moveTask.id ? { ...t, status } : t)));
    setMoveTask(null);
    const { error: err } = await supabase.from("tasks").update({ status }).eq("id", moveTask.id);
    if (err) {
      setTasks(previous);
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader title="لوحة كانبان" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
        {COLUMN_STATUSES.map((status) => {
          const items = tasks.filter((t) => t.status === status);
          return (
            <View key={status} style={{ width: 210 }} className="rounded-[14px] bg-surface p-2.5">
              <View className="mb-2.5 flex-row items-center gap-1.5 px-1">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status].dot }} />
                <Text className="text-[12.5px] font-extrabold text-foreground">{STATUS_LABEL[status]}</Text>
                <Text className="ms-auto text-[11px] font-bold text-muted">{items.length}</Text>
              </View>
              <View className="gap-2">
                {items.map((task) => (
                  <View key={task.id} className="rounded-[12px] bg-background p-2.5">
                    <TouchableOpacity onPress={() => router.push(`/tasks/${task.id}`)}>
                      <Text className="text-[12.5px] font-bold text-foreground">{task.title}</Text>
                    </TouchableOpacity>
                    <View className="mt-2 flex-row items-center gap-1.5">
                      <View className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                      <Text numberOfLines={1} className="flex-1 text-[10.5px] font-semibold text-muted">
                        {task.assignee?.full_name ?? "—"}
                      </Text>
                      <TouchableOpacity onPress={() => setMoveTask(task)} className="rounded-full bg-accent-50 px-2 py-1">
                        <Text className="text-[9.5px] font-extrabold text-accent-600">نقل</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {items.length === 0 && <Text className="py-3 text-center text-[11px] text-faint">لا توجد مهام</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {error && (
        <View className="absolute inset-x-4 bottom-6 rounded-[10px] bg-brand-red-50 p-2.5">
          <Text className="text-center text-[12px] font-bold text-brand-red-600">{error}</Text>
        </View>
      )}

      <Modal visible={!!moveTask} transparent animationType="slide" onRequestClose={() => setMoveTask(null)}>
        <TouchableOpacity className="flex-1 justify-end bg-black/40" activeOpacity={1} onPress={() => setMoveTask(null)}>
          <View className="rounded-t-[20px] bg-surface p-4.5 pb-8">
            <View className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" />
            <Text className="mb-3 text-[14px] font-extrabold text-foreground">نقل المهمة إلى</Text>
            {COLUMN_STATUSES.filter((s) => s !== moveTask?.status).map((status) => (
              <TouchableOpacity key={status} onPress={() => handleMove(status)} className="flex-row items-center gap-2.5 border-b border-border py-3">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status].dot }} />
                <Text className="text-[13px] font-bold text-foreground">{STATUS_LABEL[status]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
