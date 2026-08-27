import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { MobileHeader } from "@/components/mobile-header";
import { PRIORITY_LABEL, type Priority } from "@/lib/mobile-theme";

type Assignee = { id: string; full_name: string };
type Project = { id: string; name: string };

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

/**
 * Mirrors the web app's createTask (src/lib/actions/tasks.ts) scope, sized
 * to a mobile-first pass: title/description/assignee/project/priority/due
 * date only - no recurrence, milestones, or estimated hours yet. Writes
 * directly via Supabase (same as every other mobile screen) rather than a
 * Next.js Server Action, which isn't reachable from this app; the same
 * `tasks_insert` RLS policy (supabase/rls.sql) still enforces who can
 * assign to whom, so an employee's attempt is rejected at the database
 * even if this screen's own role gate below were somehow bypassed.
 */
export default function NewTaskScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const canCreate = profile?.role === "super_admin" || profile?.role === "department_manager";

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!profile || !canCreate) return;
    let usersQuery = supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name");
    if (profile.role === "department_manager" && profile.department_id) {
      usersQuery = usersQuery.eq("department_id", profile.department_id);
    }
    const [{ data: userRows }, { data: projectRows }] = await Promise.all([
      usersQuery,
      supabase.from("projects").select("id, name").eq("status", "active").order("name"),
    ]);
    setAssignees((userRows as Assignee[] | null) ?? []);
    setProjects((projectRows as Project[] | null) ?? []);
    setLoadingOptions(false);
  }, [profile, canCreate]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  async function submit() {
    if (!title.trim()) return setError("عنوان المهمة مطلوب");
    if (!assignedTo) return setError("اختر الموظف المسند إليه المهمة");
    setError("");
    setPending(true);
    const { error: insertError } = await supabase.from("tasks").insert({
      organization_id: profile!.organization_id,
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo,
      created_by: profile!.id,
      priority,
      status: "new",
      project_id: projectId || null,
      due_date: dueDate.trim() || null,
    });
    setPending(false);
    if (insertError) return setError("تعذر إنشاء المهمة");
    router.back();
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  if (!canCreate) {
    return (
      <View className="flex-1 bg-background">
        <MobileHeader back title="مهمة جديدة" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-[13px] text-muted">غير مصرح لك بإنشاء المهام - هذا إجراء لمدراء الأقسام والمدير العام.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled">
      <MobileHeader back title="مهمة جديدة" />
      {loadingOptions ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <View className="gap-4 p-4">
          <View>
            <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">عنوان المهمة *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="اكتب عنوان المهمة..."
              placeholderTextColor="#94a3b8"
              className="rounded-[12px] border border-border bg-surface px-3.5 py-3 text-[13.5px] text-foreground"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">الوصف</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="اكتب تفاصيل المهمة..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="rounded-[12px] border border-border bg-surface px-3.5 py-3 text-[13.5px] text-foreground"
              style={{ textAlignVertical: "top" }}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">المسؤول *</Text>
            <View className="rounded-[12px] border border-border bg-surface">
              {assignees.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setAssignedTo(a.id)}
                  className="flex-row items-center justify-between border-b border-border px-3.5 py-2.5 last:border-0"
                >
                  <Text className="text-[13px] text-foreground">{a.full_name}</Text>
                  {assignedTo === a.id && <Text className="text-accent-600">✓</Text>}
                </TouchableOpacity>
              ))}
              {assignees.length === 0 && <Text className="px-3.5 py-3 text-[12.5px] text-muted">لا يوجد موظفون متاحون</Text>}
            </View>
          </View>

          {projects.length > 0 && (
            <View>
              <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">المشروع (اختياري)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setProjectId("")}
                  className={`rounded-full border px-3.5 py-1.5 ${!projectId ? "border-accent-600 bg-accent-600" : "border-border bg-surface"}`}
                >
                  <Text className={`text-[12px] font-bold ${!projectId ? "text-white" : "text-muted"}`}>بدون مشروع</Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setProjectId(p.id)}
                    className={`rounded-full border px-3.5 py-1.5 ${projectId === p.id ? "border-accent-600 bg-accent-600" : "border-border bg-surface"}`}
                  >
                    <Text className={`text-[12px] font-bold ${projectId === p.id ? "text-white" : "text-muted"}`}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View>
            <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">الأولوية</Text>
            <View className="flex-row gap-2">
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  className={`flex-1 items-center rounded-[10px] border py-2.5 ${priority === p ? "border-accent-600 bg-accent-50" : "border-border"}`}
                >
                  <Text className={`text-[11.5px] font-bold ${priority === p ? "text-accent-700" : "text-muted"}`}>{PRIORITY_LABEL[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">تاريخ الاستحقاق (اختياري)</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              className="rounded-[12px] border border-border bg-surface px-3.5 py-3 text-[13.5px] text-foreground"
            />
          </View>

          {!!error && <Text className="text-center text-[12.5px] font-semibold text-brand-red-600">{error}</Text>}

          <TouchableOpacity
            onPress={submit}
            disabled={pending}
            className="items-center rounded-[12px] bg-accent-600 py-3.5 disabled:opacity-60"
          >
            {pending ? <ActivityIndicator color="#fff" /> : <Text className="text-[13.5px] font-extrabold text-white">إنشاء المهمة</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
