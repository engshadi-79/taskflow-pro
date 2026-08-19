"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead, sendChatMessage } from "@/lib/actions/chat";
import type { ChatMessage } from "@/lib/types/chat";

export function MobileChatThread({ conversationId, currentUserId }: { conversationId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversation_messages", { p_conversation_id: conversationId });
    // the RPC returns newest-first for "load older" pagination; the thread renders oldest-first
    setMessages(((data as ChatMessage[]) ?? []).slice().reverse());
  }, [conversationId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadMessages();
      markConversationRead(conversationId);
    });
  }, [conversationId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as { sender_id: string };
            loadMessages();
            if (row.sender_id !== currentUserId) markConversationRead(conversationId);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, loadMessages]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    const value = text;
    setText("");
    await sendChatMessage(conversationId, value);
    setSending(false);
    loadMessages();
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 p-4">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <span
                className={`max-w-[76%] rounded-[16px] px-3.5 py-2 text-[12.5px] font-semibold leading-relaxed ${
                  mine ? "bg-accent-600 text-white" : "bg-background text-foreground"
                }`}
              >
                {m.deleted_at ? <span className="italic opacity-70">تم حذف الرسالة</span> : m.content}
              </span>
            </div>
          );
        })}
        {messages.length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد رسائل بعد</p>}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="اكتب رسالة..."
          className="flex-1 rounded-full border border-border bg-background px-3.5 py-2.5 text-[12.5px] outline-none focus:border-accent-500"
        />
        <button
          type="button"
          disabled={sending}
          onClick={handleSend}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent-600 text-white disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l16-7-6 16-2.5-6.5L4 12Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
