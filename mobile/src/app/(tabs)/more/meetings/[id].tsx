import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { supabase } from "@/lib/supabase";

type MeetingStatus = "scheduled" | "completed" | "cancelled";
type Meeting = { id: string; title: string; meeting_date: string; meeting_time: string | null; location: string | null; status: MeetingStatus };
type Attendee = { id: string; user: { full_name: string } | null };
type AgendaItem = { id: string; content: string };
type MinuteItem = { id: string; content: string };

const STATUS_LABEL: Record<MeetingStatus, string> = { scheduled: "مجدوَل", completed: "منتهٍ", cancelled: "ملغى" };

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [minuteItems, setMinuteItems] = useState<MinuteItem[]>([]);

  const load = useCallback(async () => {
    const [{ data: meetingRow }, { data: attendeeRows }, { data: agendaRows }, { data: minuteRows }] = await Promise.all([
      supabase.from("meetings").select("id, title, meeting_date, meeting_time, location, status").eq("id", id).single<Meeting>(),
      supabase.from("meeting_attendees").select("id, user:users(full_name)").eq("meeting_id", id).returns<Attendee[]>(),
      supabase.from("meeting_agenda_items").select("id, content").eq("meeting_id", id).order("position", { ascending: true }).returns<AgendaItem[]>(),
      supabase.from("meeting_minutes_items").select("id, content").eq("meeting_id", id).order("created_at", { ascending: true }).returns<MinuteItem[]>(),
    ]);
    setMeeting(meetingRow ?? null);
    setAttendees(attendeeRows ?? []);
    setAgendaItems(agendaRows ?? []);
    setMinuteItems(minuteRows ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !meeting) {
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
        subtitle="تفاصيل الاجتماع"
        title={meeting.title}
        chips={
          <View className="rounded-full bg-white/15 px-2.5 py-1">
            <Text className="text-[11px] font-extrabold text-white">{STATUS_LABEL[meeting.status]}</Text>
          </View>
        }
      />

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 18 }}>
        <Text className="text-[12.5px] font-semibold text-muted">
          {meeting.meeting_date}
          {meeting.meeting_time ? ` · ${meeting.meeting_time.slice(0, 5)}` : ""}
          {meeting.location ? ` · ${meeting.location}` : ""}
        </Text>

        <View>
          <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">الحضور</Text>
          <View className="flex-row flex-wrap gap-2">
            {attendees.map((a) => (
              <View key={a.id} className="rounded-full bg-surface px-3 py-1.5">
                <Text className="text-[11.5px] font-bold text-foreground">{a.user?.full_name ?? "—"}</Text>
              </View>
            ))}
            {attendees.length === 0 && <Text className="text-[12.5px] text-muted">لا يوجد حضور مسجَّل</Text>}
          </View>
        </View>

        <View>
          <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">جدول الأعمال</Text>
          <View style={{ gap: 8 }}>
            {agendaItems.map((item) => (
              <View key={item.id} className="flex-row items-center gap-2.5">
                <View className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                <Text className="text-[12.5px] font-semibold text-muted">{item.content}</Text>
              </View>
            ))}
            {agendaItems.length === 0 && <Text className="text-[12.5px] text-muted">لا يوجد جدول أعمال</Text>}
          </View>
        </View>

        <View>
          <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">المحضر</Text>
          <View style={{ gap: 8 }}>
            {minuteItems.map((item) => (
              <View key={item.id} className="rounded-[12px] bg-surface p-3">
                <Text className="text-[12.5px] leading-6 text-muted">{item.content}</Text>
              </View>
            ))}
            {minuteItems.length === 0 && <Text className="text-[12.5px] text-muted">لم يُضَف المحضر بعد</Text>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
