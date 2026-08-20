import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type ConversationSummary = { conversation_id: string; type: "direct" | "group"; name: string | null; other_user_name: string | null };
type ChatMessage = { id: string; sender_id: string; content: string | null; deleted_at: string | null; created_at: string };

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [title, setTitle] = useState("محادثة");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.rpc("conversation_messages", { p_conversation_id: id });
    // the RPC returns newest-first for "load older" pagination; the thread renders oldest-first
    setMessages(((data as ChatMessage[]) ?? []).slice().reverse());
  }, [id]);

  const markRead = useCallback(async () => {
    if (!profile) return;
    await supabase.from("conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", profile.id);
  }, [id, profile]);

  useEffect(() => {
    supabase.rpc("conversations_with_last_message").then(({ data }) => {
      const conversation = ((data as ConversationSummary[] | null) ?? []).find((c) => c.conversation_id === id);
      if (conversation) setTitle((conversation.type === "group" ? conversation.name : conversation.other_user_name) ?? "محادثة");
    });
  }, [id]);

  useEffect(() => {
    loadMessages();
    markRead();
  }, [loadMessages, markRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const row = payload.new as { sender_id: string };
        loadMessages();
        if (row.sender_id !== profile?.id) markRead();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, profile?.id, loadMessages, markRead]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim() || sending || !profile) return;
    setSending(true);
    const value = text.trim();
    setText("");
    await supabase.from("chat_messages").insert({ conversation_id: id, sender_id: profile.id, content: value });
    setSending(false);
    loadMessages();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <MobileHeader back title={title} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text className="py-8 text-center text-[13px] text-muted">لا توجد رسائل بعد</Text>}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === profile?.id;
          return (
            <View className={`flex-row ${mine ? "justify-end" : "justify-start"}`}>
              <View style={{ maxWidth: "76%" }} className={`rounded-[16px] px-3.5 py-2 ${mine ? "bg-accent-600" : "bg-surface"}`}>
                <Text className={`text-[12.5px] font-semibold leading-relaxed ${mine ? "text-white" : "text-foreground"}`}>
                  {m.deleted_at ? "تم حذف الرسالة" : m.content}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View className="flex-row items-center gap-2 border-t border-border bg-surface p-3">
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          placeholder="اكتب رسالة..."
          placeholderTextColor="#94a3b8"
          className="flex-1 rounded-full border border-border bg-background px-3.5 py-2.5 text-[12.5px] text-foreground"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending}
          className="h-[38px] w-[38px] items-center justify-center rounded-full bg-accent-600"
          style={{ opacity: sending ? 0.6 : 1 }}
        >
          <Text className="text-white">➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
