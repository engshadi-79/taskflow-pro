import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  addDays,
  dayOfMonth,
  formatDateKey,
  isSameMonth,
  monthGridStart,
  monthLabel,
  parseDateKey,
  todayKey,
  type DateKey,
} from "@/lib/calendar-dates";

const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

type Meeting = { id: string; title: string; meeting_date: string; meeting_time: string | null };

function shiftMonth(anchor: DateKey, direction: 1 | -1): DateKey {
  const d = parseDateKey(anchor);
  return formatDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1)));
}

export default function CalendarScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [anchor, setAnchor] = useState<DateKey>(todayKey());
  const [selectedDay, setSelectedDay] = useState<DateKey | null>(null);
  const [taskDates, setTaskDates] = useState<Set<string>>(new Set());
  const [taskCountByDay, setTaskCountByDay] = useState<Record<string, number>>({});
  const [milestoneCountByDay, setMilestoneCountByDay] = useState<Record<string, number>>({});
  const [meetingsByDay, setMeetingsByDay] = useState<Record<string, Meeting[]>>({});

  const rangeStart = monthGridStart(anchor);
  const rangeEnd = addDays(rangeStart, 41);

  const load = useCallback(async () => {
    if (!profile) return;
    let taskQuery = supabase.from("tasks").select("id, due_date").gte("due_date", rangeStart).lte("due_date", rangeEnd).not("due_date", "is", null);
    if (profile.role === "employee") taskQuery = taskQuery.eq("assigned_to", profile.id);

    const [{ data: tasks }, { data: milestones }, { data: meetings }] = await Promise.all([
      taskQuery.returns<{ id: string; due_date: string }[]>(),
      supabase
        .from("project_milestones")
        .select("id, due_date")
        .gte("due_date", rangeStart)
        .lte("due_date", rangeEnd)
        .not("due_date", "is", null)
        .returns<{ id: string; due_date: string }[]>(),
      supabase
        .from("meetings")
        .select("id, title, meeting_date, meeting_time")
        .gte("meeting_date", rangeStart)
        .lte("meeting_date", rangeEnd)
        .neq("status", "cancelled")
        .returns<Meeting[]>(),
    ]);

    const dates = new Set<string>();
    const taskCounts: Record<string, number> = {};
    for (const t of tasks ?? []) {
      dates.add(t.due_date);
      taskCounts[t.due_date] = (taskCounts[t.due_date] ?? 0) + 1;
    }
    const milestoneCounts: Record<string, number> = {};
    for (const m of milestones ?? []) {
      dates.add(m.due_date);
      milestoneCounts[m.due_date] = (milestoneCounts[m.due_date] ?? 0) + 1;
    }
    const meetingGroups: Record<string, Meeting[]> = {};
    for (const mt of meetings ?? []) {
      dates.add(mt.meeting_date);
      (meetingGroups[mt.meeting_date] ??= []).push(mt);
    }

    setTaskDates(dates);
    setTaskCountByDay(taskCounts);
    setMilestoneCountByDay(milestoneCounts);
    setMeetingsByDay(meetingGroups);
  }, [profile, rangeStart, rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const todayIso = todayKey();
  const days: DateKey[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    days.push(d);
    if (d === rangeEnd) break;
  }

  const selectedTaskCount = selectedDay ? taskCountByDay[selectedDay] ?? 0 : 0;
  const selectedMilestoneCount = selectedDay ? milestoneCountByDay[selectedDay] ?? 0 : 0;
  const selectedMeetings = selectedDay ? meetingsByDay[selectedDay] ?? [] : [];
  const hasSelectedEvents = selectedTaskCount > 0 || selectedMilestoneCount > 0 || selectedMeetings.length > 0;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        back
        title="التقويم"
        subtitle={monthLabel(anchor)}
        action={
          <View className="flex-row gap-1.5">
            <TouchableOpacity onPress={() => setAnchor(shiftMonth(anchor, -1))} className="rounded-full bg-background px-2.5 py-1.5">
              <Text className="text-[12px] font-bold text-foreground">‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAnchor(todayKey())} className="rounded-full bg-background px-2.5 py-1.5">
              <Text className="text-[11px] font-bold text-foreground">اليوم</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAnchor(shiftMonth(anchor, 1))} className="rounded-full bg-background px-2.5 py-1.5">
              <Text className="text-[12px] font-bold text-foreground">›</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View className="px-4 pb-6">
        <View className="mb-2 flex-row justify-between">
          {WEEKDAYS.map((d) => (
            <Text key={d} style={{ width: `${100 / 7}%` }} className="text-center text-[10px] font-bold text-faint">
              {d}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {days.map((d) => {
            const inMonth = isSameMonth(d, anchor);
            const isToday = d === todayIso;
            const isSelected = d === selectedDay;
            const hasEvent = taskDates.has(d);
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDay(d)}
                style={{ width: `${100 / 7}%` }}
                className="items-center gap-0.5 py-1.5"
              >
                <View
                  className="h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: isSelected ? "#4f46e5" : isToday ? "#eef2ff" : "transparent" }}
                >
                  <Text
                    className="text-[12px] font-bold"
                    style={{ color: isSelected ? "#fff" : isToday ? "#4338ca" : inMonth ? "#1a202c" : "#cbd5e1" }}
                  >
                    {dayOfMonth(d)}
                  </Text>
                </View>
                <View className="h-1 w-1 rounded-full" style={{ backgroundColor: hasEvent ? (isSelected ? "#fff" : "#4f46e5") : "transparent" }} />
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedDay && (
          <View className="mt-5">
            <Text className="mb-2.5 text-[13px] font-extrabold text-foreground">{selectedDay}</Text>
            <View className="gap-2">
              {selectedTaskCount > 0 && (
                <TouchableOpacity onPress={() => router.push("/tasks")} className="rounded-[12px] bg-surface p-3 shadow">
                  <Text className="text-[12.5px] font-bold text-foreground">{selectedTaskCount} مهمة مستحقة</Text>
                </TouchableOpacity>
              )}
              {selectedMilestoneCount > 0 && (
                <View className="rounded-[12px] bg-surface p-3 shadow">
                  <Text className="text-[12.5px] font-bold text-foreground">{selectedMilestoneCount} مرحلة مشروع</Text>
                </View>
              )}
              {selectedMeetings.map((m) => (
                <View key={m.id} className="rounded-[12px] bg-surface p-3 shadow">
                  <Text className="text-[12.5px] font-bold text-foreground">
                    {m.title}
                    {m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : ""}
                  </Text>
                </View>
              ))}
              {!hasSelectedEvents && <Text className="text-[12.5px] text-muted">لا توجد أحداث في هذا اليوم</Text>}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
