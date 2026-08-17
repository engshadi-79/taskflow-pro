"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  startDirectConversation,
  startGroupConversation,
  sendChatMessage,
  deleteChatMessage,
  markConversationRead,
} from "@/lib/actions/chat";
import { Avatar } from "@/components/shared/avatar";
import {
  ChatIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UsersIcon,
} from "@/components/shared/icons";
import { Modal } from "@/components/shared/modal";
import { timeAgo } from "@/lib/format-time-ago";
import type {
  ChatMessage,
  ConversationParticipant,
  ConversationSummary,
  OrgMemberDirectoryEntry,
} from "@/lib/types/chat";

export function ChatApp({
  currentUserId,
  initialConversations,
  directory,
  initialSelectedId,
}: {
  currentUserId: string;
  initialConversations: ConversationSummary[];
  directory: OrgMemberDirectoryEntry[];
  initialSelectedId: string | null;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const selectedIdRef = useRef(selectedId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectedConversation = conversations.find((c) => c.conversation_id === selectedId) ?? null;

  const refreshConversations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversations_with_last_message");
    if (data) setConversations(data as ConversationSummary[]);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("conversation_messages", { p_conversation_id: conversationId });
    // the RPC returns newest-first for "load older" pagination; the thread renders oldest-first
    setMessages(((data as ChatMessage[]) ?? []).slice().reverse());
    setLoadingMessages(false);
  }, []);

  const loadParticipants = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversation_participants_with_profiles", {
      p_conversation_id: conversationId,
    });
    setParticipants((data as ConversationParticipant[]) ?? []);
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      setError(null);
      loadMessages(id);
      loadParticipants(id);
      markConversationRead(id);
      setConversations((prev) => prev.map((c) => (c.conversation_id === id ? { ...c, unread_count: 0 } : c)));
      router.replace(`/dashboard/chat?c=${id}`, { scroll: false });
    },
    [loadMessages, loadParticipants, router]
  );

  // deep-link from a notification / initial page load. Nested inside a
  // .then() rather than called directly at the effect's top level, same
  // shape as the realtime subscription effect below (getSession().then(...)) -
  // react-hooks/set-state-in-effect flags a state-setting call made
  // synchronously in an effect body, not one nested inside a callback.
  useEffect(() => {
    if (!initialSelectedId) return;
    Promise.resolve().then(() => {
      loadMessages(initialSelectedId);
      loadParticipants(initialSelectedId);
      markConversationRead(initialSelectedId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // One realtime subscription for every chat_messages row the caller can
  // see (RLS already scopes it to conversations they participate in) -
  // same "no filter, rely on RLS" shape kanban-board.tsx already uses.
  // Reloading via the RPC on every event (rather than merging the raw
  // payload) matches comments-section.tsx's precedent, since the payload
  // alone has no sender name/avatar to render with.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("chat-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const row = payload.new as { conversation_id: string; sender_id: string };
            if (row.conversation_id === selectedIdRef.current) {
              loadMessages(row.conversation_id);
              if (row.sender_id !== currentUserId) markConversationRead(row.conversation_id);
            }
            refreshConversations();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, loadMessages, refreshConversations]);

  async function handleSend() {
    if (!selectedId) return;
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!text.trim() && !file) return;

    setSending(true);
    setError(null);
    const result = await sendChatMessage(selectedId, text, file);
    setSending(false);

    if (result.error && !result.id) {
      setError(result.error);
      return;
    }
    if (result.error) setError(result.error); // message sent, attachment failed
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadMessages(selectedId);
    refreshConversations();
  }

  async function handleDelete(messageId: string) {
    if (!selectedId) return;
    if (!confirm("حذف هذه الرسالة؟")) return;
    const result = await deleteChatMessage(messageId);
    if (result.error) {
      setError(result.error);
      return;
    }
    loadMessages(selectedId);
  }

  async function handleStartDirect(otherUserId: string) {
    const result = await startDirectConversation(otherUserId);
    if (result.error || !result.id) {
      setError(result.error || "تعذر بدء المحادثة");
      return;
    }
    setNewChatOpen(false);
    await refreshConversations();
    selectConversation(result.id);
  }

  async function handleStartGroup(name: string, memberIds: string[]) {
    const result = await startGroupConversation(name, memberIds);
    if (result.error || !result.id) {
      setError(result.error || "تعذر إنشاء المجموعة");
      return;
    }
    setNewChatOpen(false);
    await refreshConversations();
    selectConversation(result.id);
  }

  const headerName = selectedConversation
    ? selectedConversation.type === "group"
      ? selectedConversation.name ?? "مجموعة"
      : selectedConversation.other_user_name ?? "محادثة"
    : null;
  const headerAvatar = selectedConversation?.type === "direct" ? selectedConversation.other_user_avatar : null;

  return (
    <div className="flex h-[75vh] min-h-[480px] overflow-hidden rounded-[18px] border border-border bg-surface">
      {/* conversation list */}
      <div
        className={`flex w-full flex-col border-e border-border sm:w-[320px] sm:shrink-0 ${
          selectedId ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-[16px] text-foreground">المحادثات</h2>
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-white hover:bg-accent-600"
            aria-label="محادثة جديدة"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-6 text-center text-[13px] text-muted">لا توجد محادثات بعد</p>
          )}
          {conversations.map((c) => {
            const name = c.type === "group" ? c.name ?? "مجموعة" : c.other_user_name ?? "مستخدم";
            const active = c.conversation_id === selectedId;
            return (
              <button
                key={c.conversation_id}
                type="button"
                onClick={() => selectConversation(c.conversation_id)}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-start transition-colors ${
                  active ? "bg-accent-50" : "hover:bg-background"
                }`}
              >
                {c.type === "group" ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
                    <UsersIcon className="h-5 w-5" />
                  </span>
                ) : (
                  <Avatar src={c.other_user_avatar} name={name} size={44} decorative />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-bold text-foreground">{name}</span>
                    {c.last_message_at && (
                      <span className="shrink-0 text-[11px] text-faint">{timeAgo(c.last_message_at)}</span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-muted">{c.last_message ?? "لا رسائل بعد"}</span>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-extrabold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* thread */}
      <div className={`flex min-w-0 flex-1 flex-col ${selectedId ? "flex" : "hidden sm:flex"}`}>
        {!selectedConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <ChatIcon className="h-8 w-8" />
            <p className="text-[13px]">اختر محادثة أو ابدأ محادثة جديدة</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[13px] font-bold text-accent-600 hover:underline sm:hidden"
              >
                ← رجوع
              </button>
              {selectedConversation.type === "group" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
                  <UsersIcon className="h-4 w-4" />
                </span>
              ) : (
                <Avatar src={headerAvatar} name={headerName ?? ""} size={36} decorative />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[14px] font-extrabold text-foreground">{headerName}</h3>
                {selectedConversation.type === "group" && (
                  <p className="truncate text-[11.5px] text-muted">
                    {participants.map((p) => p.full_name).join("، ")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <p className="text-center text-[12.5px] text-muted">جارٍ التحميل...</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-[12.5px] text-muted">لا رسائل بعد — ابدأ المحادثة</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const mine = m.sender_id === currentUserId;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                          {!mine && selectedConversation.type === "group" && (
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
                                  <ChatAttachmentLink key={a.id} attachment={a} light={mine} />
                                ))}
                              </>
                            )}
                          </div>
                          <div className={`mt-0.5 flex items-center gap-2 text-[10.5px] text-faint ${mine ? "justify-end" : ""}`}>
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
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {error && <p className="px-4 pb-1 text-[12px] text-red-600">{error}</p>}

            <div className="flex items-center gap-2 border-t border-border p-3">
              <input ref={fileInputRef} type="file" className="hidden" id="chat-file-input" />
              <label
                htmlFor="chat-file-input"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-background"
                title="إرفاق ملف"
              >
                <PaperclipIcon className="h-[18px] w-[18px]" />
              </label>
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
          </>
        )}
      </div>

      {newChatOpen && (
        <NewChatDialog
          directory={directory}
          onClose={() => setNewChatOpen(false)}
          onStartDirect={handleStartDirect}
          onStartGroup={handleStartGroup}
        />
      )}
    </div>
  );
}

function ChatAttachmentLink({ attachment, light }: { attachment: ChatMessage["attachments"][number]; light: boolean }) {
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

  return (
    <div className="mt-2">
      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={attachment.file_name} className="max-h-56 max-w-full rounded-[10px] object-cover" />
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

export function NewChatDialog({
  directory,
  onClose,
  onStartDirect,
  onStartGroup,
}: {
  directory: OrgMemberDirectoryEntry[];
  onClose: () => void;
  onStartDirect: (userId: string) => void;
  onStartGroup: (name: string, memberIds: string[]) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const filtered = directory.filter((d) => d.full_name.includes(query.trim()));

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  return (
    <Modal title="محادثة جديدة" onClose={onClose}>
      <div className="mb-3 flex rounded-[10px] border border-border bg-background p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMode("direct")}
          className={`flex-1 rounded-[7px] py-1.5 ${mode === "direct" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
        >
          فردية
        </button>
        <button
          type="button"
          onClick={() => setMode("group")}
          className={`flex-1 rounded-[7px] py-1.5 ${mode === "group" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
        >
          مجموعة
        </button>
      </div>

      {mode === "group" && (
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="اسم المجموعة"
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
        />
      )}

      <div className="relative mb-2">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن زميل..."
          className="w-full rounded-md border border-border bg-background py-2 ps-9 pe-3 text-sm text-foreground outline-none focus:border-accent-500"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto rounded-[10px] border border-border">
        {filtered.length === 0 && <p className="p-4 text-center text-[12.5px] text-muted">لا نتائج</p>}
        {filtered.map((d) => {
          const checked = selectedIds.includes(d.id);
          return (
            <label
              key={d.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-background"
            >
              <Avatar src={d.avatar_url} name={d.full_name} size={32} decorative />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-foreground">{d.full_name}</span>
                {d.job_title && <span className="block truncate text-[11px] text-muted">{d.job_title}</span>}
              </span>
              <input
                type={mode === "direct" ? "radio" : "checkbox"}
                name="member"
                checked={checked}
                onChange={() => (mode === "direct" ? setSelectedIds([d.id]) : toggle(d.id))}
                className="h-4 w-4 accent-accent-600"
              />
            </label>
          );
        })}
      </div>

      <button
        type="button"
        disabled={busy || selectedIds.length === 0 || (mode === "group" && !groupName.trim())}
        onClick={async () => {
          setBusy(true);
          if (mode === "direct") await onStartDirect(selectedIds[0]);
          else await onStartGroup(groupName, selectedIds);
          setBusy(false);
        }}
        className="mt-4 w-full rounded-[10px] bg-accent-500 py-2.5 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {busy ? "جارٍ الإنشاء..." : mode === "direct" ? "بدء المحادثة" : "إنشاء المجموعة"}
      </button>
    </Modal>
  );
}
