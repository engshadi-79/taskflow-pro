"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startDirectConversation, startGroupConversation } from "@/lib/actions/chat";
import { ChatThread } from "@/components/dashboard/chat-thread";
import { Avatar } from "@/components/shared/avatar";
import { ChatIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/shared/icons";
import { Modal } from "@/components/shared/modal";
import { timeAgo } from "@/lib/format-time-ago";
import type { ConversationSummary, OrgMemberDirectoryEntry } from "@/lib/types/chat";

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
  const [newChatOpen, setNewChatOpen] = useState(false);
  const router = useRouter();

  const selectedConversation = conversations.find((c) => c.conversation_id === selectedId) ?? null;

  const refreshConversations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversations_with_last_message");
    if (data) setConversations(data as ConversationSummary[]);
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      setConversations((prev) => prev.map((c) => (c.conversation_id === id ? { ...c, unread_count: 0 } : c)));
      router.replace(`/dashboard/chat?c=${id}`, { scroll: false });
    },
    [router]
  );

  // One realtime subscription to keep the conversation list's previews/
  // unread counts live - ChatThread owns its own separate, filtered
  // subscription for the currently open thread's messages.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("chat-list-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
          refreshConversations();
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refreshConversations]);

  async function handleStartDirect(otherUserId: string) {
    const result = await startDirectConversation(otherUserId);
    if (result.error || !result.id) {
      return { error: result.error || "تعذر بدء المحادثة" };
    }
    setNewChatOpen(false);
    await refreshConversations();
    selectConversation(result.id);
  }

  async function handleStartGroup(name: string, memberIds: string[]) {
    const result = await startGroupConversation(name, memberIds);
    if (result.error || !result.id) {
      return { error: result.error || "تعذر إنشاء المجموعة" };
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
          <ChatThread
            conversationId={selectedConversation.conversation_id}
            headerName={headerName ?? ""}
            headerAvatar={headerAvatar}
            isGroup={selectedConversation.type === "group"}
            currentUserId={currentUserId}
            onBack={() => setSelectedId(null)}
          />
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

export function NewChatDialog({
  directory,
  onClose,
  onStartDirect,
  onStartGroup,
}: {
  directory: OrgMemberDirectoryEntry[];
  onClose: () => void;
  onStartDirect: (userId: string) => Promise<{ error?: string } | void>;
  onStartGroup: (name: string, memberIds: string[]) => Promise<{ error?: string } | void>;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {error && <p className="mt-2 text-[12px] font-bold text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy || selectedIds.length === 0}
        onClick={async () => {
          if (mode === "group" && !groupName.trim()) {
            setError("أدخل اسم المجموعة");
            return;
          }
          setError(null);
          setBusy(true);
          const result =
            mode === "direct" ? await onStartDirect(selectedIds[0]) : await onStartGroup(groupName, selectedIds);
          setBusy(false);
          if (result?.error) setError(result.error);
        }}
        className="mt-4 w-full rounded-[10px] bg-accent-500 py-2.5 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {busy ? "جارٍ الإنشاء..." : mode === "direct" ? "بدء المحادثة" : "إنشاء المجموعة"}
      </button>
    </Modal>
  );
}
