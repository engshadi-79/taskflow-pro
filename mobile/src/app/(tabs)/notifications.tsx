import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { BellIcon } from "@/components/tab-icons";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/format-time-ago";

type Notification = {
  id: string;
  title: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .order("created_at", { ascending: false })
      .returns<Notification[]>();
    setNotifications(data ?? []);
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

  async function markOneRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
    setMarkingAll(false);
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        title="الإشعارات"
        action={
          hasUnread ? (
            <TouchableOpacity onPress={markAllRead} disabled={markingAll}>
              <Text className="text-[12px] font-extrabold text-accent-600" style={{ opacity: markingAll ? 0.6 : 1 }}>
                تعليم الكل كمقروء
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-10 text-center text-[13px] text-muted">لا توجد إشعارات</Text>}
          renderItem={({ item: n }) => (
            <TouchableOpacity
              onPress={() => !n.is_read && markOneRead(n.id)}
              className={`flex-row items-center gap-3 rounded-[14px] p-3.5 shadow ${n.is_read ? "bg-surface" : "bg-accent-50"}`}
            >
              <View
                className="h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: n.is_read ? "#e2e8f0" : "#4f46e5" }}
              >
                <BellIcon color={n.is_read ? "#64748b" : "#fff"} size={16} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className={`text-[12.5px] leading-relaxed ${n.is_read ? "font-semibold text-muted" : "font-extrabold text-foreground"}`}>
                  {n.title ? `${n.title} — ${n.message}` : n.message}
                </Text>
                <Text className="mt-1 text-[11px] font-semibold text-faint">{timeAgo(n.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
