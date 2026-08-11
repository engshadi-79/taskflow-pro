"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import {
  AlertIcon,
  BellIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  FolderIcon,
  RefreshIcon,
  UserIcon,
  XCircleIcon,
} from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";
import { useSystemNotifications } from "@/lib/hooks/use-system-notifications";
import type { Notification } from "@/lib/types/notification";

const PANEL_LIMIT = 12;

type Meta = { label: string; tint: string; icon: React.ReactNode };

/** Every type emitted by the DB triggers in supabase/notifications_and_reports.sql. */
const TYPE_META: Record<string, Meta> = {
  task_assigned: {
    label: "مهمة جديدة",
    tint: "bg-accent-500",
    icon: <CheckIcon className="h-[17px] w-[17px]" />,
  },
  task_pending_review: {
    label: "بانتظار مراجعتك",
    tint: "bg-orange-500",
    icon: <EyeIcon className="h-[17px] w-[17px]" />,
  },
  task_completed: {
    label: "تم الاعتماد",
    tint: "bg-green-500",
    icon: <CheckCircleIcon className="h-[17px] w-[17px]" />,
  },
  task_rejected: {
    label: "تم الرفض",
    tint: "bg-brand-red-500",
    icon: <XCircleIcon className="h-[17px] w-[17px]" />,
  },
  task_overdue: {
    label: "مهمة متأخرة",
    tint: "bg-brand-red-500",
    icon: <AlertIcon className="h-[17px] w-[17px]" />,
  },
  task_status_changed: {
    label: "تغيير الحالة",
    tint: "bg-accent-600",
    icon: <RefreshIcon className="h-[17px] w-[17px]" />,
  },
  user_pending_approval: {
    label: "بانتظار موافقتك",
    tint: "bg-orange-500",
    icon: <UserIcon className="h-[17px] w-[17px]" />,
  },
  workflow_pending_approval: {
    label: "طلب بانتظار موافقتك",
    tint: "bg-orange-500",
    icon: <EyeIcon className="h-[17px] w-[17px]" />,
  },
  workflow_approved: {
    label: "تم قبول طلبك",
    tint: "bg-green-500",
    icon: <CheckCircleIcon className="h-[17px] w-[17px]" />,
  },
  workflow_rejected: {
    label: "تم رفض طلبك",
    tint: "bg-brand-red-500",
    icon: <XCircleIcon className="h-[17px] w-[17px]" />,
  },
  meeting_invited: {
    label: "دعوة اجتماع",
    tint: "bg-accent-500",
    icon: <UserIcon className="h-[17px] w-[17px]" />,
  },
  meeting_reminder_1day: {
    label: "تذكير باجتماع",
    tint: "bg-orange-500",
    icon: <ClockIcon className="h-[17px] w-[17px]" />,
  },
  meeting_reminder_1hour: {
    label: "تذكير باجتماع",
    tint: "bg-orange-500",
    icon: <ClockIcon className="h-[17px] w-[17px]" />,
  },
  knowledge_published: {
    label: "مقال جديد",
    tint: "bg-accent-600",
    icon: <FolderIcon className="h-[17px] w-[17px]" />,
  },
  comment_reply: {
    label: "رد على تعليقك",
    tint: "bg-accent-500",
    icon: <ChatIcon className="h-[17px] w-[17px]" />,
  },
  comment_mention: {
    label: "تمت الإشارة إليك",
    tint: "bg-purple-500",
    icon: <ChatIcon className="h-[17px] w-[17px]" />,
  },
};

const FALLBACK: Meta = {
  label: "تذكير",
  tint: "bg-purple-500",
  icon: <ClockIcon className="h-[17px] w-[17px]" />,
};

function metaFor(type: string): Meta {
  // the five reminder_* types all share one presentation
  return TYPE_META[type] ?? FALLBACK;
}

const WORKFLOW_TYPES = ["workflow_pending_approval", "workflow_approved", "workflow_rejected"];

function urlFor(
  n: Pick<Notification, "type" | "task_id" | "meeting_id" | "article_id" | "comment_id">
): string {
  if (n.type === "user_pending_approval") return "/dashboard/employees";
  // notifications has no request_id column, only task_id (unused here) -
  // the list page is the honest link we can give without a schema change
  if (WORKFLOW_TYPES.includes(n.type)) return "/dashboard/workflow-requests";
  if (n.meeting_id) return `/dashboard/meetings/${n.meeting_id}`;
  if (n.article_id) return `/dashboard/knowledge/${n.article_id}`;
  // no anchor/scroll-to-comment support on the task page yet - landing on
  // the task itself (where the comment thread renders) is still correct
  if (n.comment_id && n.task_id) return `/dashboard/tasks/${n.task_id}`;
  return n.task_id ? `/dashboard/tasks/${n.task_id}` : "/dashboard/notifications";
}

export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const [count, setCount] = useState(initialUnreadCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const { showNotification } = useSystemNotifications({
    // client-side navigation, so clicking a toast does not reload the app
    onOpen: (url) => router.push(url),
  });

  // Held in a ref so changing a notification preference does not tear down and
  // re-subscribe the realtime channel.
  const notifyRef = useRef(showNotification);
  useEffect(() => {
    notifyRef.current = showNotification;
  }, [showNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // RLS scopes this to the signed-in user's own rows
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PANEL_LIMIT)
      .returns<Notification[]>();
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime's postgres_changes stream is filtered by RLS, which needs
    // this client's JWT to already be attached to the socket - subscribing
    // immediately after createClient() can race ahead of that internal
    // handshake, so the channel joins as an unauthenticated connection and
    // every row gets silently filtered out (the insert still succeeds; it
    // just never reaches this tab). Awaiting getSession() first forces that
    // handshake to complete before the channel is ever created.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setCount((c) => c + 1);
            const row = payload.new as Notification;
            // keep an already-open panel in sync without a refetch
            setItems((prev) =>
              prev ? [row, ...prev].slice(0, PANEL_LIMIT) : prev
            );

            // raise an OS toast alongside the in-app badge. The hook decides
            // whether it actually fires, based on permission, the user's
            // preference and whether this tab is focused.
            notifyRef.current(metaFor(row.type).label, {
              body: row.message,
              tag: row.id,
              url: urlFor(row),
            });
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  // dismiss on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) load();
  }

  async function markAll() {
    setCount(0);
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
    await markAllNotificationsRead();
  }

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.is_read) {
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? prev
      );
      await markNotificationRead(n.id);
    }
    router.push(urlFor(n));
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          count > 0 ? `الإشعارات، ${count} غير مقروء` : "الإشعارات"
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition-colors hover:brightness-95"
      >
        <BellIcon className="h-[19px] w-[19px]" />
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="الإشعارات"
          className="absolute end-0 top-[calc(100%+10px)] z-40 w-[min(92vw,380px)] overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20"
        >
          <div className="banner-violet flex items-center justify-between gap-3 px-4 py-3.5 text-white">
            <div>
              <div className="text-[15px] font-black">الإشعارات</div>
              <div className="text-[11.5px] font-medium text-white/75">
                آخر التحديثات
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1.5 text-[12px] font-extrabold text-white transition-transform hover:scale-[1.04]"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                عرض الكل
              </Link>
              <button
                type="button"
                onClick={markAll}
                disabled={count === 0}
                title="تحديد الكل كمقروء"
                aria-label="تحديد الكل كمقروء"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-white/40 disabled:opacity-40"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                جارٍ التحميل...
              </p>
            )}

            {!loading && items?.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-faint">
                  <BellIcon className="h-5 w-5" />
                </span>
                <p className="text-[13px] text-muted">لا توجد إشعارات</p>
              </div>
            )}

            {!loading &&
              items?.map((n) => {
                const meta = metaFor(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-start transition-colors last:border-b-0 hover:bg-background ${
                      // /40 rather than a heavier tint: at /60 the secondary
                      // text drops to 4.45:1, just under AA
                      n.is_read ? "" : "bg-accent-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${meta.tint}`}
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-extrabold text-foreground">
                          {meta.label}
                        </span>
                        {!n.is_read && (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full bg-pink-500"
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-5 text-muted">
                        {n.message}
                      </span>
                      {/* text-muted, not text-faint: faint is only 2.56:1 even
                          on white, which fails AA for text this size */}
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <ClockIcon className="h-3 w-3" />
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="border-t border-border p-3">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-full bg-accent-600 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-accent-700"
            >
              <BellIcon className="h-4 w-4" />
              عرض جميع الإشعارات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
