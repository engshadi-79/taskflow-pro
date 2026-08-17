"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { startDirectConversation, startGroupConversation } from "@/lib/actions/chat";
import { NewChatDialog } from "@/components/dashboard/chat-app";
import { ChatThread } from "@/components/dashboard/chat-thread";
import { Avatar } from "@/components/shared/avatar";
import { ChatIcon, CloseIcon, ExternalLinkIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";
import type { ConversationSummary, OrgMemberDirectoryEntry } from "@/lib/types/chat";

/**
 * A floating quick-access bubble (same fixed bottom-end shape as
 * AiAssistantPanel, stacked above it). The outer header (title/+/full-page/
 * close) stays constant; the body switches between the conversation list
 * and an inline ChatThread - reading and replying never has to leave this
 * popup, matching the reference screenshot the user shared. "صفحة كاملة"
 * remains for anyone who wants the full multi-conversation layout instead.
 */
export function ChatWidget({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [directory, setDirectory] = useState<OrgMemberDirectoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.rpc("conversations_with_last_message");
    if (data) setConversations(data as ConversationSummary[]);
  }

  // nested inside a .then() rather than called directly at the effect's
  // top level - react-hooks/set-state-in-effect flags a state-setting
  // call made synchronously in an effect body, not one nested in a callback.
  useEffect(() => {
    Promise.resolve().then(() => refresh());
  }, []);

  // lets the topbar's chat icon (a separate component, mounted elsewhere in
  // the layout) open this same popup instead of navigating away
  useEffect(() => {
    function onToggle() {
      setOpen((o) => !o);
    }
    window.addEventListener("monjez:toggle-chat-widget", onToggle);
    return () => window.removeEventListener("monjez:toggle-chat-widget", onToggle);
  }, []);

  // realtime: keep the badge/list live even while the panel is closed -
  // ChatThread owns its own separate, filtered subscription for whichever
  // conversation is open inline below.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("chat-widget-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
          refresh();
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function openNewChatDialog() {
    if (directory.length === 0) {
      const supabase = createClient();
      const { data } = await supabase.rpc("org_members_directory");
      if (data) setDirectory(data as OrgMemberDirectoryEntry[]);
    }
    setNewChatOpen(true);
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setConversations((prev) => prev.map((c) => (c.conversation_id === id ? { ...c, unread_count: 0 } : c)));
  }

  async function handleStartDirect(otherUserId: string) {
    const result = await startDirectConversation(otherUserId);
    if (result.error || !result.id) return { error: result.error || "تعذر بدء المحادثة" };
    setNewChatOpen(false);
    await refresh();
    selectConversation(result.id);
  }

  async function handleStartGroup(name: string, memberIds: string[]) {
    const result = await startGroupConversation(name, memberIds);
    if (result.error || !result.id) return { error: result.error || "تعذر إنشاء المجموعة" };
    setNewChatOpen(false);
    await refresh();
    selectConversation(result.id);
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const filtered = conversations.filter((c) => {
    const name = c.type === "group" ? c.name ?? "" : c.other_user_name ?? "";
    return name.includes(query.trim());
  });
  const selectedConversation = conversations.find((c) => c.conversation_id === selectedId) ?? null;
  const headerName = selectedConversation
    ? selectedConversation.type === "group"
      ? selectedConversation.name ?? "مجموعة"
      : selectedConversation.other_user_name ?? "محادثة"
    : null;
  const headerAvatar = selectedConversation?.type === "direct" ? selectedConversation.other_user_avatar : null;

  return (
    <div ref={wrapRef} className="fixed bottom-24 end-5 z-50">
      {open && (
        <div
          role="dialog"
          aria-label="المحادثات"
          className="mb-3 flex h-[min(70vh,520px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20"
        >
          <div className="banner-teal flex items-center justify-between gap-2 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2">
              <ChatIcon className="h-5 w-5" />
              <span className="text-[15px] font-black">المحادثات</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={selectedId ? `/dashboard/chat?c=${selectedId}` : "/dashboard/chat"}
                onClick={() => setOpen(false)}
                title="صفحة كاملة"
                className="flex h-8 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[11.5px] font-bold text-white transition-colors hover:bg-white/30"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                صفحة كاملة
              </Link>
              <button
                type="button"
                onClick={openNewChatDialog}
                aria-label="محادثة جديدة"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedConversation ? (
            <ChatThread
              conversationId={selectedConversation.conversation_id}
              headerName={headerName ?? ""}
              headerAvatar={headerAvatar}
              isGroup={selectedConversation.type === "group"}
              currentUserId={currentUserId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <>
              <div className="border-b border-border p-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="بحث عن المحادثات"
                    className="w-full rounded-full border border-border bg-background py-2 ps-9 pe-3 text-[13px] text-foreground outline-none focus:border-accent-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="p-6 text-center text-[12.5px] text-muted">لا توجد محادثات</p>
                )}
                {filtered.map((c) => {
                  const name = c.type === "group" ? c.name ?? "مجموعة" : c.other_user_name ?? "مستخدم";
                  return (
                    <button
                      key={c.conversation_id}
                      type="button"
                      onClick={() => selectConversation(c.conversation_id)}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-start last:border-b-0 hover:bg-background"
                    >
                      {c.type === "group" ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
                          <UsersIcon className="h-[18px] w-[18px]" />
                        </span>
                      ) : (
                        <Avatar src={c.other_user_avatar} name={name} size={40} decorative />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-foreground">{name}</span>
                          {c.last_message_at && (
                            <span className="shrink-0 text-[10.5px] text-faint">{timeAgo(c.last_message_at)}</span>
                          )}
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11.5px] text-muted">{c.last_message ?? "لا رسائل بعد"}</span>
                          {c.unread_count > 0 && (
                            <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-accent-500 px-1 text-[9.5px] font-extrabold text-white">
                              {c.unread_count}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="المحادثات"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-xl shadow-black/25 transition-transform hover:scale-105"
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <ChatIcon className="h-6 w-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red-500 px-1 text-[10px] font-extrabold text-white">
            {totalUnread}
          </span>
        )}
      </button>

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
