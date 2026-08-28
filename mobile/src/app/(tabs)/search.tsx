import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { FolderIcon, SearchIcon, TasksIcon, PersonIcon } from "@/components/tab-icons";
import { supabase } from "@/lib/supabase";

type TaskResult = { id: string; title: string };
type ProjectResult = { id: string; name: string };
type UserResult = { id: string; full_name: string };

/**
 * Mobile-first scope of the web app's unified command palette
 * (command-palette.tsx) - tasks, projects, and people, the three kinds
 * most useful to search for on the go. Meetings/departments/articles stay
 * a possible later addition rather than guessed at here.
 */
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setTasks([]);
      setProjects([]);
      setUsers([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const pattern = `%${q.trim()}%`;
    const [{ data: taskRows }, { data: projectRows }, { data: userRows }] = await Promise.all([
      supabase.from("tasks").select("id, title").ilike("title", pattern).limit(6).returns<TaskResult[]>(),
      supabase.from("projects").select("id, name").ilike("name", pattern).limit(6).returns<ProjectResult[]>(),
      supabase.from("users").select("id, full_name").ilike("full_name", pattern).eq("is_active", true).limit(6).returns<UserResult[]>(),
    ]);
    setTasks(taskRows ?? []);
    setProjects(projectRows ?? []);
    setUsers(userRows ?? []);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const noResults = searched && !loading && tasks.length === 0 && projects.length === 0 && users.length === 0;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="البحث الشامل" />
      <View className="px-4 pb-3">
        <View className="flex-row items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3.5 py-2.5">
          <SearchIcon color="#94a3b8" size={17} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن مهمة، مشروع، أو موظف..."
            placeholderTextColor="#94a3b8"
            autoFocus
            className="flex-1 text-[13.5px] text-foreground"
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24, gap: 16 }}>
        {loading && <ActivityIndicator className="mt-4" color="#4f46e5" />}

        {!loading && tasks.length > 0 && (
          <View>
            <Text className="mb-2 text-[12px] font-extrabold text-muted">المهام</Text>
            <View className="gap-2">
              {tasks.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => router.push(`/tasks/${t.id}`)}
                  className="flex-row items-center gap-3 rounded-[12px] bg-surface p-3 shadow"
                >
                  <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50">
                    <TasksIcon color="#4f46e5" size={15} />
                  </View>
                  <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-foreground">
                    {t.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!loading && projects.length > 0 && (
          <View>
            <Text className="mb-2 text-[12px] font-extrabold text-muted">المشاريع</Text>
            <View className="gap-2">
              {projects.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => router.push({ pathname: "/more/projects/[id]", params: { id: p.id } })}
                  className="flex-row items-center gap-3 rounded-[12px] bg-surface p-3 shadow"
                >
                  <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-50">
                    <FolderIcon color="#db2777" size={15} />
                  </View>
                  <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-foreground">
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!loading && users.length > 0 && (
          <View>
            <Text className="mb-2 text-[12px] font-extrabold text-muted">الموظفون</Text>
            <View className="gap-2">
              {users.map((u) => (
                <View key={u.id} className="flex-row items-center gap-3 rounded-[12px] bg-surface p-3 shadow">
                  <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50">
                    <PersonIcon color="#9333ea" size={15} />
                  </View>
                  <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-foreground">
                    {u.full_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {noResults && <Text className="mt-6 text-center text-[13px] text-muted">لا توجد نتائج</Text>}
      </ScrollView>
    </View>
  );
}
