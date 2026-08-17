"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage, deleteChatMessage, markConversationRead } from "@/lib/actions/chat";
import { Avatar } from "@/components/shared/avatar";
import { EmojiIcon, ImageIcon, MicIcon, PaperclipIcon, SendIcon, UsersIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";
import type { ChatMessage, ConversationParticipant } from "@/lib/types/chat";

const EMOJIS = [
  "😀", "😂", "😊", "😍", "😘", "😉", "😎", "🤔",
  "😢", "😭", "😡", "👍", "👎", "👏", "🙏", "❤️",
  "🔥", "🎉", "✅", "❌", "⚠️", "📌", "💡", "🕐",
  "📅", "✔️", "😅", "🙌", "🤝", "👀", "💯", "🚀",
];

/**
 * The message thread itself - shared between the full /dashboard/chat page
 * and the floating ChatWidget popup, so a conversation can be read/replied
 * to inline in either surface instead of duplicating this UI twice.
 * Owns its own data/realtime for this one conversation_id; the parent
 * (ChatApp/ChatWidget) is responsible for its own separate "refresh the
 * conversation list previews" subscription.
 */
export function ChatThread({
  conversationId,
  headerName,
  headerAvatar,
  isGroup,
  currentUserId,
  onBack,
}: {
  conversationId: string;
  headerName: string;
  headerAvatar: string | null;
  isGroup: boolean;
  currentUserId: string;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("conversation_messages", { p_conversation_id: conversationId });
    // the RPC returns newest-first for "load older" pagination; the thread renders oldest-first
    setMessages(((data as ChatMessage[]) ?? []).slice().reverse());
    setLoading(false);
  }, [conversationId]);

  const loadParticipants = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversation_participants_with_profiles", {
      p_conversation_id: conversationId,
    });
    setParticipants((data as ConversationParticipant[]) ?? []);
  }, [conversationId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setError(null);
      loadMessages();
      loadParticipants();
      markConversationRead(conversationId);
    });
  }, [conversationId, loadMessages, loadParticipants]);

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
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
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

  function clearSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSend() {
    if (!text.trim() && !selectedFile) return;

    setSending(true);
    setError(null);
    try {
      const result = await sendChatMessage(conversationId, text, selectedFile);
      if (result.error && !result.id) {
        setError(result.error);
        return;
      }
      if (result.error) setError(result.error); // message sent, attachment failed
      setText("");
      clearSelectedFile();
      loadMessages();
    } catch {
      // e.g. the request was rejected before reaching the server action
      // (oversized body, network drop) - surface it instead of failing silently
      setError("تعذر إرسال الرسالة، تحقق من حجم الملف واتصال الإنترنت");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // strip codec info (e.g. "audio/webm;codecs=opus") - the server's
        // attachment-type allowlist matches the bare mime type exactly
        const mimeType = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        // ASCII-only filename - it becomes a storage object path segment,
        // and Arabic text there caused chat_attachments_storage_insert to fail
        setSelectedFile(new File([blob], `voice-message-${Date.now()}.${ext}`, { type: mimeType }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError("تعذر الوصول إلى الميكروفون");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function insertEmoji(emoji: string) {
    setText((t) => t + emoji);
  }

  async function handleDelete(messageId: string) {
    if (!confirm("حذف هذه الرسالة؟")) return;
    const result = await deleteChatMessage(messageId);
    if (result.error) {
      setError(result.error);
      return;
    }
    loadMessages();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="text-[15px] font-bold text-accent-600 hover:underline"
          >
            ←
          </button>
        )}
        {isGroup ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
            <UsersIcon className="h-4 w-4" />
          </span>
        ) : (
          <Avatar src={headerAvatar} name={headerName} size={36} decorative />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-extrabold text-foreground">{headerName}</h3>
          {isGroup && (
            <p className="truncate text-[11.5px] text-muted">
              {participants.length > 0 ? `${participants.length} أعضاء` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-[12.5px] text-muted">جارٍ التحميل...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-[12.5px] text-muted">لا رسائل بعد — ابدأ المحادثة</p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    {!mine && isGroup && (
                      <p className="mb-0.5 text-[11px] font-bold text-muted">{m.sender_name}</p>
                    )}
                    <div
                      className={`rounded-[14px] px-3.5 py-2.5 text-[13px] leading-6 ${
                        m.deleted_at
                          ? "border border-dashed border-border text-faint"
                          : mine
                            ? "bg-accent-500 text-white"
                            : "bg-background text-foreground"
                      }`}
                    >
                      {m.deleted_at ? (
                        <span className="italic">تم حذف هذه الرسالة</span>
                      ) : (
                        <>
                          {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                          {m.attachments.map((a) => (
                            <ChatAttachmentPreview key={a.id} attachment={a} light={mine} />
                          ))}
                        </>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 flex items-center gap-2 text-[10.5px] text-faint ${mine ? "justify-end" : ""}`}
                    >
                      <span>{timeAgo(m.created_at)}</span>
                      {mine && !m.deleted_at && (
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="font-bold text-brand-red-500 hover:underline"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-1 text-[12px] text-red-600">{error}</p>}

      <div className="border-t border-border p-3">
        {selectedFile && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-[10px] bg-background px-3 py-2 text-[12px]">
            <span className="truncate font-bold text-foreground">
              {selectedFile.type.startsWith("audio/") ? "🎤 رسالة صوتية" : `📎 ${selectedFile.name}`}
            </span>
            <button type="button" onClick={clearSelectedFile} className="shrink-0 font-bold text-brand-red-500 hover:underline">
              إزالة
            </button>
          </div>
        )}
        {isRecording && (
          <p className="mb-2 text-[12px] font-bold text-brand-red-500">🔴 جارٍ التسجيل... {recordSeconds}s</p>
        )}
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background"
            title="إرفاق ملف"
          >
            <PaperclipIcon className="h-[18px] w-[18px]" />
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background"
            title="إرسال صورة"
          >
            <ImageIcon className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              isRecording ? "bg-brand-red-500 text-white" : "text-muted hover:bg-background"
            }`}
            title={isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"}
          >
            <MicIcon className="h-[18px] w-[18px]" />
          </button>

          <div ref={emojiWrapRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background"
              title="إيموجي"
            >
              <EmojiIcon className="h-[18px] w-[18px]" />
            </button>
            {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
          </div>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="اكتب رسالة..."
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-[13px] text-foreground outline-none focus:border-accent-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-60"
            aria-label="إرسال"
          >
            <SendIcon className="h-[16px] w-[16px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full start-0 z-10 mb-2 grid w-[224px] grid-cols-8 gap-0.5 rounded-[12px] border border-border bg-surface p-2 shadow-xl"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex h-7 w-7 items-center justify-center rounded text-[15px] hover:bg-background"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function ChatAttachmentPreview({
  attachment,
  light,
}: {
  attachment: ChatMessage["attachments"][number];
  light: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("task-attachments")
      .createSignedUrl(attachment.file_url, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.file_url]);

  const isImage = attachment.file_type?.startsWith("image/");
  const isAudio = attachment.file_type?.startsWith("audio/");

  return (
    <div className="mt-2">
      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={attachment.file_name} className="max-h-56 max-w-full rounded-[10px] object-cover" />
      ) : url && isAudio ? (
        <audio controls src={url} className="h-9 max-w-full" />
      ) : (
        <a
          href={url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={`block truncate text-[12px] font-bold underline ${light ? "text-white" : "text-accent-600"}`}
        >
          📎 {attachment.file_name}
        </a>
      )}
    </div>
  );
}
