import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { supabase } from "@/lib/supabase";

type ConversationSummary = {
  conversation_id: string;
  type: "direct" | "group";
  name: string | null;
  other_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export default function ChatListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("conversations_with_last_message");
    setConversations((data as ConversationSummary[] | null) ?? []);
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
      <MobileHeader back title="المحادثات" />
      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.conversation_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text className="py-10 text-center text-[13px] text-muted">لا توجد محادثات بعد</Text>}
          renderItem={({ item: c }) => {
            const title = (c.type === "group" ? c.name : c.other_user_name) ?? "محادثة";
            return (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/more/chat/[id]", params: { id: c.conversation_id } })}
                className="flex-row items-center gap-3 border-b border-border py-3"
              >
                <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-600">
                  <Text className="text-[14px] font-extrabold text-white">{title[0] ?? "—"}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">
                      {title}
                    </Text>
                    {c.last_message_at && (
                      <Text className="shrink-0 text-[11px] font-semibold text-faint">{new Date(c.last_message_at).toLocaleDateString("ar")}</Text>
                    )}
                  </View>
                  <Text numberOfLines={1} className="mt-0.5 text-[12px] font-semibold text-muted">
                    {c.last_message ?? "لا توجد رسائل بعد"}
                  </Text>
                </View>
                {c.unread_count > 0 && (
                  <View className="h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-accent-600 px-1.5">
                    <Text className="text-[10.5px] font-extrabold text-white">{c.unread_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
