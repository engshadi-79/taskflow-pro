import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { supabase } from "@/lib/supabase";

type MeetingStatus = "scheduled" | "completed" | "cancelled";
type Meeting = { id: string; title: string; meeting_date: string; meeting_time: string | null; location: string | null; status: MeetingStatus };

const STATUS_LABEL: Record<MeetingStatus, string> = { scheduled: "مجدوَل", completed: "منتهٍ", cancelled: "ملغى" };
const STATUS_BADGE: Record<MeetingStatus, { bg: string; text: string }> = {
  scheduled: { bg: "#eef2ff", text: "#4338ca" },
  completed: { bg: "#ecfdf5", text: "#16a34a" },
  cancelled: { bg: "#e2e8f0", text: "#94a3b8" },
};

export default function MeetingsScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time, location, status")
      .order("meeting_date", { ascending: false })
      .returns<Meeting[]>();
    setMeetings(data ?? []);
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
      <MobileHeader back title="الاجتماعات" subtitle={`${meetings.length} اجتماع`} />
      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-10 text-center text-[13px] text-muted">لا توجد اجتماعات بعد</Text>}
          renderItem={({ item: m }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/more/meetings/[id]", params: { id: m.id } })}
              className="rounded-[14px] bg-surface p-3.5 shadow"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text numberOfLines={1} className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">
                  {m.title}
                </Text>
                <View className="shrink-0 rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_BADGE[m.status].bg }}>
                  <Text className="text-[10.5px] font-extrabold" style={{ color: STATUS_BADGE[m.status].text }}>
                    {STATUS_LABEL[m.status]}
                  </Text>
                </View>
              </View>
              <Text className="mt-2 text-[11.5px] font-semibold text-muted">
                {m.meeting_date}
                {m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : ""}
                {m.location ? ` · ${m.location}` : ""}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
