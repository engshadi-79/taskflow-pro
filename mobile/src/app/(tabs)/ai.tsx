import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { CheckIcon, SendIcon, SparklesIcon, XCircleIcon } from "@/components/tab-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { API_BASE_URL } from "@/lib/api-config";

type SuggestionRow = {
  id: string;
  action_type: string;
  summary: string;
  target_id: string;
  status: "pending" | "confirmed" | "rejected";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  suggestions?: SuggestionRow[];
};

const MAX_HISTORY_TURNS = 10;
// Mirrors src/lib/actions/ai.ts's own MANAGE_ROLES - confirming a suggestion
// is a real task write, gated the same way as any other task mutation
// (RLS backs this up regardless: tasks_insert/tasks_update have no policy
// matching "employee" at all).
const MANAGE_ROLES = ["super_admin", "department_manager"];

let idCounter = 0;
function genId() {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

/**
 * Mobile port of src/components/dashboard/ai-assistant-panel.tsx. The chat
 * call itself has to go through the web app's own API route (the Gemini key
 * and the tool-execution loop are server-only) - see src/lib/supabase/
 * mobile-auth.ts for the bearer-token path added to that route specifically
 * for this screen. Confirming/rejecting a suggestion, on the other hand, is
 * a plain table write once you already know the payload shape, so it's
 * reimplemented directly here against Supabase (same tables, same RLS) —
 * consistent with how every other mobile screen in this app talks to
 * Supabase directly rather than proxying through a web Server Action.
 */
export default function AiAssistantScreen() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0 || sending) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, sending]);

  function pushMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  function updateSuggestion(messageId: string, suggestionId: string, status: "confirmed" | "rejected") {
    setMessages((prev) =>
      prev.map((m) =>
        m.id !== messageId
          ? m
          : { ...m, suggestions: m.suggestions?.map((s) => (s.id === suggestionId ? { ...s, status } : s)) }
      )
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !profile) return;

    const userMsg: ChatMessage = { id: genId(), role: "user", content: text };
    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    pushMessage(userMsg);
    setInput("");
    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });
      const data = await res.json();

      if (!res.ok) {
        pushMessage({ id: genId(), role: "error", content: data.error ?? "حدث خطأ غير متوقع" });
      } else {
        pushMessage({ id: genId(), role: "assistant", content: data.reply, suggestions: data.suggestions ?? [] });
      }
    } catch {
      pushMessage({ id: genId(), role: "error", content: "تعذر الاتصال بالمساعد الذكي - تأكد من اتصالك بالإنترنت" });
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(messageId: string, suggestion: SuggestionRow) {
    if (!profile) return;

    const { data: action, error: fetchError } = await supabase
      .from("ai_suggested_actions")
      .select("id, action_type, payload, status")
      .eq("id", suggestion.id)
      .single();

    if (fetchError || !action || action.status !== "pending") {
      pushMessage({ id: genId(), role: "error", content: "تم التعامل مع هذا الاقتراح مسبقًا" });
      return;
    }
    if (!MANAGE_ROLES.includes(profile.role)) {
      pushMessage({ id: genId(), role: "error", content: "غير مصرح لك بتنفيذ هذا الإجراء" });
      return;
    }

    let opError: string | null = null;
    if (action.action_type === "reassign_task") {
      const payload = action.payload as { task_id: string; new_assignee_id: string };
      const { error } = await supabase.from("tasks").update({ assigned_to: payload.new_assignee_id }).eq("id", payload.task_id);
      opError = error?.message ?? null;
    } else if (action.action_type === "create_subtasks") {
      const payload = action.payload as { task_id: string; subtasks: { title: string; assigned_to: string }[] };
      const { error } = await supabase.from("tasks").insert(
        payload.subtasks.map((s) => ({
          organization_id: profile.organization_id,
          title: s.title,
          assigned_to: s.assigned_to,
          created_by: profile.id,
          parent_task_id: payload.task_id,
        }))
      );
      opError = error?.message ?? null;
    } else if (action.action_type === "create_task") {
      const payload = action.payload as {
        title: string;
        description: string | null;
        assigned_to: string;
        priority: string;
        due_date: string | null;
      };
      const { error } = await supabase.from("tasks").insert({
        organization_id: profile.organization_id,
        title: payload.title,
        description: payload.description ?? null,
        assigned_to: payload.assigned_to,
        created_by: profile.id,
        priority: payload.priority ?? "medium",
        due_date: payload.due_date ?? null,
      });
      opError = error?.message ?? null;
    } else {
      opError = "نوع إجراء غير معروف";
    }

    if (opError) {
      pushMessage({ id: genId(), role: "error", content: opError });
      return;
    }

    await supabase
      .from("ai_suggested_actions")
      .update({ status: "confirmed", resolved_by: profile.id, resolved_at: new Date().toISOString() })
      .eq("id", suggestion.id);
    updateSuggestion(messageId, suggestion.id, "confirmed");
  }

  async function handleReject(messageId: string, suggestion: SuggestionRow) {
    if (!profile) return;
    await supabase
      .from("ai_suggested_actions")
      .update({ status: "rejected", resolved_by: profile.id, resolved_at: new Date().toISOString() })
      .eq("id", suggestion.id)
      .eq("status", "pending");
    updateSuggestion(messageId, suggestion.id, "rejected");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <MobileHeader back gradient title="المساعد الذكي" subtitle="مرتبط ببياناتك وصلاحياتك" />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-3 px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-accent-50">
              <SparklesIcon color="#4f46e5" size={26} />
            </View>
            <Text className="text-center text-[13px] leading-6 text-muted">
              اسألني عن أداء الأقسام، حمل العمل، المهام المعرضة للتأخير، أو اطلب تلخيص اجتماع أو مشروع. لن أُنفّذ أي
              تغيير على بياناتك إلا بعد أن تؤكده بنفسك.
            </Text>
          </View>
        }
        renderItem={({ item: m }) => (
          <View className={`flex-row ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <View style={{ maxWidth: "88%" }} className="gap-2">
              <View
                className={`whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 ${
                  m.role === "user" ? "bg-accent-600" : m.role === "error" ? "bg-pink-50" : "bg-surface"
                }`}
              >
                <Text
                  className={`text-[13px] leading-6 ${
                    m.role === "user" ? "font-semibold text-white" : m.role === "error" ? "font-bold text-pink-600" : "text-foreground"
                  }`}
                >
                  {m.content}
                </Text>
              </View>

              {m.suggestions?.map((s) => (
                <View key={s.id} className="rounded-[14px] border border-accent-200 bg-accent-50 px-3.5 py-3">
                  <Text className="text-[12.5px] font-bold text-accent-700">{s.summary}</Text>
                  {s.status === "pending" && (
                    <View className="mt-2.5 flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => handleConfirm(m.id, s)}
                        className="flex-row items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1.5"
                      >
                        <CheckIcon color="#fff" size={13} />
                        <Text className="text-[12px] font-extrabold text-white">تأكيد</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleReject(m.id, s)}
                        className="flex-row items-center gap-1.5 rounded-full bg-white px-3 py-1.5"
                      >
                        <XCircleIcon color="#64748b" size={13} />
                        <Text className="text-[12px] font-extrabold text-muted">تجاهل</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {s.status === "confirmed" && <Text className="mt-2 text-[12px] font-bold text-green-600">تم التنفيذ</Text>}
                  {s.status === "rejected" && <Text className="mt-2 text-[12px] font-bold text-muted">تم التجاهل</Text>}
                </View>
              ))}
            </View>
          </View>
        )}
        ListFooterComponent={
          sending ? (
            <View className="flex-row items-center gap-2 px-1">
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text className="text-[12px] font-semibold text-faint">جارٍ التفكير...</Text>
            </View>
          ) : null
        }
      />

      <View className="flex-row items-center gap-2 border-t border-border bg-surface p-3">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          editable={!sending}
          placeholder="اكتب سؤالك..."
          placeholderTextColor="#94a3b8"
          className="flex-1 rounded-full border border-border bg-background px-3.5 py-2.5 text-[13px] text-foreground"
        />
        <TouchableOpacity
          onPress={send}
          disabled={sending || !input.trim()}
          className="h-[38px] w-[38px] items-center justify-center rounded-full bg-accent-600"
          style={{ opacity: sending || !input.trim() ? 0.4 : 1 }}
        >
          <SendIcon color="#fff" size={16} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
