import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { GRADIENT_PRIMARY, PRIORITY_COLOR, STATUS_COLOR, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/mobile-theme";

type SummaryRow = { value: number; label: string };
type UrgentTask = { id: string; title: string; due_date: string | null; status: TaskStatus; priority: Priority };
type Meeting = { id: string; title: string; meeting_date: string; meeting_time: string | null };
type ApprovalRow = { id: string; title: string; template: { name: string } | null };
type StalledProject = { id: string; name: string; due_date: string };

type SummaryCounts = {
  active_count: number;
  pending_review_count: number;
  team_overdue_count: number;
  completed_count: number;
  total_count: number;
};

function Ring({ value, label }: { value: number; label: string }) {
  const size = 82;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 100);
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef2ff" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text className="text-[14px] font-extrabold text-foreground">{clamped}%</Text>
      <Text className="text-[8.5px] font-bold text-faint">{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isManagerRole = profile?.role !== "employee";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [ringValue, setRingValue] = useState(0);
  const [ringLabel, setRingLabel] = useState("");
  const [progressLabel, setProgressLabel] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTask[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalRow[]>([]);
  const [stalledProjects, setStalledProjects] = useState<StalledProject[]>([]);
  const [myMeetings, setMyMeetings] = useState<Meeting[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const nowDate = new Date();
    const todayIso = nowDate.toISOString().slice(0, 10);

    const { data: myMeetingsRaw } = await supabase
      .from("meeting_attendees")
      .select("meeting:meetings!inner(id, title, meeting_date, meeting_time, status)")
      .eq("user_id", profile.id)
      .gte("meetings.meeting_date", todayIso)
      .neq("meetings.status", "cancelled")
      .order("meeting_date", { referencedTable: "meetings", ascending: true })
      .limit(3);
    setMyMeetings(
      ((myMeetingsRaw as unknown as { meeting: Meeting }[] | null) ?? []).map((r) => r.meeting)
    );

    if (!isManagerRole) {
      const [{ data: tasks }, { data: workloadRows }] = await Promise.all([
        supabase.from("tasks").select("id, title, due_date, status, priority").eq("assigned_to", profile.id),
        supabase.rpc("employee_workload"),
      ]);
      const myTasks = (tasks ?? []) as UrgentTask[];
      const overdue = myTasks.filter((t) => t.status !== "completed" && t.due_date && t.due_date.slice(0, 10) < todayIso).length;
      const dueToday = myTasks.filter((t) => t.status !== "completed" && t.due_date?.slice(0, 10) === todayIso).length;
      const completed = myTasks.filter((t) => t.status === "completed").length;
      const myWorkload = (workloadRows as { load_percent: number }[] | null)?.[0];

      setSummaryRows([
        { value: myTasks.length, label: "إجمالي مهامي" },
        { value: dueToday, label: "مستحقة اليوم" },
        { value: overdue, label: "متأخرة" },
      ]);
      setRingValue(myTasks.length ? Math.round((completed / myTasks.length) * 100) : 0);
      setRingLabel("نسبة الإنجاز");
      setProgressLabel("حملي الوظيفي");
      setProgressValue(myWorkload?.load_percent ?? 0);
      setUrgentTasks(
        myTasks
          .filter((t) => t.status !== "completed" && t.due_date && t.due_date.slice(0, 10) <= todayIso)
          .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
          .slice(0, 3)
      );
      setApprovalQueue([]);
      setStalledProjects([]);
    } else {
      const scopeDepartmentId = profile.role === "department_manager" ? profile.department_id : null;
      const [{ data: summaryRaw }, { data: slaRows }, { data: pendingApprovalsRaw }, { data: atRiskProjectsRaw }, { data: myUrgentTasksRaw }] =
        await Promise.all([
          supabase.rpc("dashboard_summary_counts", {
            p_employee_id: null,
            p_employee_ids: null,
            p_project_id: null,
            p_status: null,
            p_priority: null,
            p_since: new Date(nowDate.getTime() - 7 * 86400000).toISOString(),
            p_two_weeks_ago: new Date(nowDate.getTime() - 14 * 86400000).toISOString(),
            p_today: todayIso,
          }),
          supabase.rpc("sla_report", { p_department_id: scopeDepartmentId, p_user_id: null }),
          supabase
            .from("workflow_requests")
            .select("id, title, created_at, template:workflow_templates(name)")
            .eq("status", "pending")
            .neq("requested_by", profile.id)
            .order("created_at", { ascending: true })
            .limit(2),
          supabase
            .from("projects")
            .select("id, name, due_date")
            .eq("status", "active")
            .not("due_date", "is", null)
            .lt("due_date", todayIso)
            .order("due_date", { ascending: true })
            .limit(2),
          supabase
            .from("tasks")
            .select("id, title, due_date, status, priority")
            .eq("assigned_to", profile.id)
            .neq("status", "completed")
            .lte("due_date", todayIso)
            .order("due_date", { ascending: true })
            .limit(3),
        ]);

      const summary = (summaryRaw as SummaryCounts[] | null)?.[0];
      const sla = (slaRows as { compliance_rate: number }[] | null)?.[0];
      const completionRate = summary?.total_count ? Math.round(((summary.completed_count ?? 0) / summary.total_count) * 100) : 0;

      setSummaryRows([
        { value: summary?.active_count ?? 0, label: "نشطة" },
        { value: summary?.pending_review_count ?? 0, label: "بانتظار المراجعة" },
        { value: summary?.team_overdue_count ?? 0, label: "متأخرة" },
      ]);
      setRingValue(completionRate);
      setRingLabel("معدل الإنجاز");
      setProgressLabel("الالتزام بـ SLA");
      setProgressValue(sla?.compliance_rate ?? 100);
      setApprovalQueue((pendingApprovalsRaw as ApprovalRow[] | null) ?? []);
      setStalledProjects((atRiskProjectsRaw as StalledProject[] | null) ?? []);
      setUrgentTasks((myUrgentTasksRaw as UrgentTask[] | null) ?? []);
    }
    setLoading(false);
  }, [profile, isManagerRole]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <ScrollView className="flex-1 bg-background" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <LinearGradient
        colors={GRADIENT_PRIMARY}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 pb-16"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={signOut} className="h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-white/15">
            <Text className="text-white">⎋</Text>
          </TouchableOpacity>
          <View className="rounded-full bg-white/15 px-3 py-1.5">
            <Text className="text-[11px] font-bold text-white">
              {profile.role === "super_admin" ? "مدير عام" : profile.role === "department_manager" ? "مدير قسم" : "موظف"}
            </Text>
          </View>
        </View>
        <Text className="mb-1 text-[13px] font-bold text-white/85">
          {isManagerRole ? "مرحبًا بك 👋" : `مرحبًا، ${profile.full_name.split(" ")[0]}`}
        </Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ lineHeight: 28 }}
          className="text-[19px] font-black text-white"
        >
          {profile.full_name}
        </Text>
      </LinearGradient>

      <View className="mt-1 px-4">
        <View className="rounded-[20px] bg-surface p-4 shadow-lg">
          <View className="flex-row items-center gap-4">
            <View className="flex-1 gap-3">
              {summaryRows.map((row) => (
                <View key={row.label} className="flex-row items-center gap-2.5">
                  <Text className="text-[16px] font-black text-foreground">{row.value}</Text>
                  <Text className="text-[11px] font-bold text-faint">{row.label}</Text>
                </View>
              ))}
            </View>
            <Ring value={ringValue} label={ringLabel} />
          </View>
          <View className="mb-1.5 mt-3.5 flex-row items-center justify-between">
            <Text className="text-[11.5px] font-bold text-foreground">{progressLabel}</Text>
            <Text className="text-[11.5px] font-bold text-teal-600">{progressValue}%</Text>
          </View>
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-teal-50">
            <View className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(progressValue, 100)}%` }} />
          </View>
        </View>
      </View>

      {urgentTasks.length > 0 && (
        <View className="px-4 pb-2 pt-5">
          <Text className="mb-2.5 text-[14px] font-extrabold text-foreground">مهامي العاجلة</Text>
          <View className="gap-2.5">
            {urgentTasks.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => router.push(`/tasks/${t.id}`)}
                className="flex-row items-center gap-2.5 rounded-[14px] bg-surface p-3.5 shadow"
              >
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[t.priority] }} />
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-[13.5px] font-bold text-foreground">
                    {t.title}
                  </Text>
                  <Text className="mt-0.5 text-[11.5px] font-semibold text-muted">{t.due_date ?? "بدون موعد"}</Text>
                </View>
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_COLOR[t.status].bg }}>
                  <Text className="text-[10.5px] font-extrabold" style={{ color: STATUS_COLOR[t.status].text }}>
                    {STATUS_LABEL[t.status]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {isManagerRole && (
        <View className="px-4 pb-2 pt-1">
          <Text className="mb-2.5 text-[14px] font-extrabold text-foreground">طلبات تحتاج موافقة</Text>
          <View className="mb-4.5 gap-2.5">
            {approvalQueue.length === 0 && <Text className="text-[12.5px] text-muted">لا توجد طلبات بانتظار موافقتك</Text>}
            {approvalQueue.map((r) => (
              <View key={r.id} className="rounded-[14px] bg-surface p-3.5 shadow">
                <Text className="text-[13.5px] font-bold text-foreground">
                  {r.template?.name ? `${r.title} (${r.template.name})` : r.title}
                </Text>
              </View>
            ))}
          </View>

          <Text className="mb-2.5 text-[14px] font-extrabold text-foreground">مشاريع متعثرة</Text>
          <View className="gap-2.5">
            {stalledProjects.length === 0 && <Text className="text-[12.5px] text-muted">لا توجد مشاريع متعثرة</Text>}
            {stalledProjects.map((p) => (
              <View key={p.id} className="rounded-[14px] border border-brand-red-100 bg-surface p-3.5">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[13.5px] font-bold text-foreground">{p.name}</Text>
                  <Text className="text-[11px] font-extrabold text-brand-red-600">
                    متأخر منذ {Math.max(1, Math.round((new Date(todayIso).getTime() - new Date(p.due_date).getTime()) / 86400000))} يوم
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="px-4 pb-8 pt-1">
        <Text className="mb-2.5 text-[14px] font-extrabold text-foreground">اجتماعاتي القادمة</Text>
        <View className="gap-2.5">
          {myMeetings.length === 0 && <Text className="text-[12.5px] text-muted">لا توجد اجتماعات قادمة</Text>}
          {myMeetings.map((m) => (
            <View key={m.id} className="flex-row items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow">
              <View className="h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-teal-50">
                <Text>🗓</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[13px] font-bold text-foreground">
                  {m.title}
                </Text>
                <Text className="mt-0.5 text-[11px] font-semibold text-muted">
                  {m.meeting_time ? `${m.meeting_date} - ${m.meeting_time.slice(0, 5)}` : m.meeting_date}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
