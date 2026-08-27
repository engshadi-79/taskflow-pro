import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { MobileHeader } from "@/components/mobile-header";
import { GRADIENT_PRIMARY, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/mobile-theme";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  assigned_to: string;
  assignee: { full_name: string } | null;
};
type ChecklistItem = { id: string; content: string; is_completed: boolean };
type Comment = { id: string; author_name: string; content: string; created_at: string };
type TimeEntry = { id: string; task_id: string };

function timeAgo(iso: string) {
  const diffMin = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `قبل ${diffH} س`;
  return `قبل ${Math.round(diffH / 24)} يوم`;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [actualSeconds, setActualSeconds] = useState(0);
  const [hasRunning, setHasRunning] = useState(false);
  const [myOpenEntry, setMyOpenEntry] = useState<TimeEntry | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [pending, setPending] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [{ data: taskRow }, { data: checklistRows }, { data: commentsRaw }, { data: myOpenRows }, { data: summaryRows }] =
      await Promise.all([
        supabase.from("tasks").select("*, assignee:users!tasks_assigned_to_fkey(full_name)").eq("id", id).single(),
        supabase.from("task_checklists").select("id, content, is_completed").eq("task_id", id).order("created_at", { ascending: true }),
        supabase.rpc("task_comments_with_authors", { p_task_id: id }),
        supabase.from("task_time_entries").select("id, task_id").eq("user_id", profile.id).is("ended_at", null).limit(1),
        supabase.rpc("task_time_summary", { p_task_id: id }),
      ]);

    setTask(taskRow as Task);
    setChecklist((checklistRows as ChecklistItem[] | null) ?? []);
    setComments(((commentsRaw as unknown as Comment[] | null) ?? []));
    setMyOpenEntry((myOpenRows as TimeEntry[] | null)?.[0] ?? null);
    const summary = (summaryRows as { actual_seconds: number; has_running: boolean }[] | null)?.[0];
    setActualSeconds(summary?.actual_seconds ?? 0);
    setHasRunning(summary?.has_running ?? false);
    setLoading(false);
  }, [profile, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!hasRunning) return;
    tickRef.current = setInterval(() => setActualSeconds((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [hasRunning]);

  async function toggleChecklistItem(item: ChecklistItem) {
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_completed: !c.is_completed } : c)));
    await supabase.from("task_checklists").update({ is_completed: !item.is_completed }).eq("id", item.id);
  }

  async function addChecklistItem() {
    if (!newChecklistText.trim() || !profile || !id) return;
    const content = newChecklistText.trim();
    setNewChecklistText("");
    const { data } = await supabase
      .from("task_checklists")
      .insert({ task_id: id, content, created_by: profile.id })
      .select("id, content, is_completed")
      .single();
    if (data) setChecklist((prev) => [...prev, data as ChecklistItem]);
  }

  async function addComment() {
    if (!newComment.trim() || !profile || !id) return;
    const content = newComment.trim();
    setNewComment("");
    await supabase.from("task_comments").insert({ task_id: id, user_id: profile.id, content });
    load();
  }

  async function startTimer() {
    if (!profile || !id) return;
    setPending(true);
    await supabase.from("task_time_entries").insert({ task_id: id, user_id: profile.id, started_at: new Date().toISOString() });
    await load();
    setPending(false);
  }

  async function stopTimer() {
    if (!myOpenEntry) return;
    setPending(true);
    await supabase.from("task_time_entries").update({ ended_at: new Date().toISOString() }).eq("id", myOpenEntry.id).is("ended_at", null);
    await load();
    setPending(false);
  }

  async function submitForReview() {
    if (!task) return;
    setPending(true);
    await supabase.from("tasks").update({ status: "pending_review" }).eq("id", task.id);
    await load();
    setPending(false);
  }

  async function reviewDecision(decision: "approve" | "reject") {
    if (!task) return;
    if (decision === "reject" && !reviewNotes.trim()) return;
    setPending(true);
    const nextStatus = decision === "approve" ? "completed" : "in_progress";
    await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
    if (reviewNotes.trim() && profile) {
      await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: profile.id,
        content: (decision === "approve" ? "تم الاعتماد: " : "تم الرفض: ") + reviewNotes.trim(),
      });
    }
    setReviewNotes("");
    await load();
    setPending(false);
  }

  if (loading || !task || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  const canManage = profile.role === "super_admin" || profile.role === "department_manager";
  const myEntryOnThisTask = myOpenEntry?.task_id === task.id ? myOpenEntry : null;
  const runningElsewhere = !!myOpenEntry && myOpenEntry.task_id !== task.id;
  const hrs = Math.floor(actualSeconds / 3600);
  const mins = Math.floor((actualSeconds % 3600) / 60);
  const secs = actualSeconds % 60;
  const timeDisplay = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled">
      <MobileHeader
        back
        gradient
        subtitle="تفاصيل المهمة"
        title={task.title}
        chips={
          <>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_COLOR[task.status].bg }}>
              <Text className="text-[11px] font-extrabold" style={{ color: STATUS_COLOR[task.status].text }}>
                {STATUS_LABEL[task.status]}
              </Text>
            </View>
            <View className="rounded-full bg-white/15 px-2.5 py-1">
              <Text className="text-[11px] font-extrabold text-white">أولوية {PRIORITY_LABEL[task.priority]}</Text>
            </View>
          </>
        }
      />

      <View className="gap-4.5 p-4">
        <View className="flex-row gap-4">
          <Text className="text-[12px] font-semibold text-muted">
            المسؤول: <Text className="font-bold text-foreground">{task.assignee?.full_name ?? "—"}</Text>
          </Text>
          <Text className="text-[12px] font-semibold text-muted">
            الموعد: <Text className="font-bold text-foreground">{task.due_date ?? "—"}</Text>
          </Text>
        </View>

        {task.description && <Text className="text-[13px] leading-6 text-muted">{task.description}</Text>}

        {checklist.length > 0 && (
          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[12px] font-bold text-foreground">نسبة الإنجاز</Text>
              <Text className="text-[12px] font-bold text-accent-600">
                {Math.round((checklist.filter((c) => c.is_completed).length / checklist.length) * 100)}٪
              </Text>
            </View>
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-accent-50">
              <View
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${Math.round((checklist.filter((c) => c.is_completed).length / checklist.length) * 100)}%` }}
              />
            </View>
          </View>
        )}

        {profile.id === task.assigned_to && ["new", "in_progress"].includes(task.status) && (
          <TouchableOpacity onPress={submitForReview} disabled={pending} className="items-center rounded-[12px] bg-accent-600 py-3 disabled:opacity-60">
            <Text className="text-[13px] font-extrabold text-white">إرسال للمراجعة</Text>
          </TouchableOpacity>
        )}

        {canManage && task.status === "pending_review" && (
          <View className="rounded-[14px] border border-orange-200 bg-orange-50 p-3.5">
            <Text className="mb-2.5 text-[12.5px] font-extrabold text-orange-800">مراجعة المهمة</Text>
            <TextInput
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder="ملاحظات (مطلوبة عند الرفض)"
              multiline
              className="mb-2.5 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-foreground"
            />
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => reviewDecision("approve")} disabled={pending} className="flex-1 items-center rounded-[10px] bg-green-600 py-2.5">
                <Text className="text-[12.5px] font-extrabold text-white">قبول</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => reviewDecision("reject")}
                disabled={pending}
                className="flex-1 items-center rounded-[10px] border border-brand-red-500 bg-surface py-2.5"
              >
                <Text className="text-[12.5px] font-extrabold text-brand-red-600">رفض</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View>
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[13px] font-extrabold text-foreground">تتبّع الوقت</Text>
            <Text className="text-[15px] font-black text-accent-600">{timeDisplay}</Text>
          </View>
          {myEntryOnThisTask ? (
            <TouchableOpacity onPress={stopTimer} disabled={pending} className="items-center rounded-[10px] bg-brand-red-50 py-2.5">
              <Text className="text-[12.5px] font-extrabold text-brand-red-600">⏸ إيقاف مؤقت</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={startTimer} disabled={pending || runningElsewhere} className="items-center rounded-[10px] bg-green-50 py-2.5 disabled:opacity-60">
              <Text className="text-[12.5px] font-extrabold text-green-600">▶ بدء التتبع</Text>
            </TouchableOpacity>
          )}
          {runningElsewhere && <Text className="mt-1.5 text-[11.5px] text-muted">لديك جلسة توقيت مفتوحة على مهمة أخرى</Text>}
        </View>

        <View>
          <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">قائمة التحقق</Text>
          <View className="gap-2.5">
            {checklist.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => toggleChecklistItem(item)} className="flex-row items-center gap-2.5">
                <View
                  className="h-5 w-5 items-center justify-center rounded-[6px] border-2"
                  style={{ borderColor: item.is_completed ? "#4f46e5" : "#e2e8f0", backgroundColor: item.is_completed ? "#4f46e5" : "transparent" }}
                >
                  {item.is_completed && <Text className="text-[11px] font-black text-white">✓</Text>}
                </View>
                <Text className={`text-[13px] font-semibold ${item.is_completed ? "text-faint line-through" : "text-foreground"}`}>{item.content}</Text>
              </TouchableOpacity>
            ))}
            {checklist.length === 0 && <Text className="text-[12.5px] text-muted">لا توجد خطوات بعد</Text>}
          </View>
          <View className="mt-2.5 flex-row gap-2">
            <TextInput
              value={newChecklistText}
              onChangeText={setNewChecklistText}
              placeholder="أضف خطوة..."
              className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-foreground"
            />
            <TouchableOpacity onPress={addChecklistItem} className="items-center justify-center rounded-[10px] bg-accent-500 px-3.5">
              <Text className="text-[12px] font-extrabold text-white">إضافة</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">التعليقات</Text>
          <View className="mb-2.5 gap-2.5">
            {comments.map((c) => (
              <View key={c.id} className="rounded-[12px] bg-surface p-3">
                <View className="flex-row justify-between">
                  <Text className="text-[12px] font-extrabold text-foreground">{c.author_name}</Text>
                  <Text className="text-[10.5px] text-faint">{timeAgo(c.created_at)}</Text>
                </View>
                <Text className="mt-1 text-[12.5px] text-muted">{c.content}</Text>
              </View>
            ))}
            {comments.length === 0 && <Text className="text-[12.5px] text-muted">لا توجد تعليقات بعد</Text>}
          </View>
          <View className="flex-row gap-2">
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="اكتب تعليقًا..."
              className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-foreground"
            />
            <TouchableOpacity onPress={addComment} className="items-center justify-center rounded-[10px] bg-accent-500 px-3.5">
              <Text className="text-[12px] font-extrabold text-white">إرسال</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
