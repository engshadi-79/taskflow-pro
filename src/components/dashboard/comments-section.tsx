"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteComment, editComment, type TaskFormState } from "@/lib/actions/tasks";
import { createClient } from "@/lib/supabase/client";
import { PaperclipIcon } from "@/components/shared/icons";
import { timeAgo } from "@/lib/format-time-ago";
import type { TaskCommentWithAuthor } from "@/lib/types/task";

const initialState: TaskFormState = {};

type MentionableUser = { id: string; full_name: string };

export function CommentsSection({
  taskId,
  comments,
  currentUserId,
  canDeleteAny,
  mentionableUsers,
}: {
  taskId: string;
  comments: TaskCommentWithAuthor[];
  currentUserId: string;
  canDeleteAny: boolean;
  mentionableUsers: MentionableUser[];
}) {
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const router = useRouter();

  // task_comments realtime (added to supabase_realtime in
  // task_comments_v2.sql) - router.refresh() re-runs the server component's
  // task_comments_with_authors() RPC, the one path that correctly resolves
  // author names under RLS, instead of trying to merge raw payloads here
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`task-comments:${taskId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
          () => router.refresh()
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [taskId, router]);

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">الملاحظات والتعليقات</h2>

      <ul className="space-y-3">
        {topLevel.map((comment) => (
          <li key={comment.id}>
            <CommentItem
              comment={comment}
              taskId={taskId}
              currentUserId={currentUserId}
              canDeleteAny={canDeleteAny}
              onReply={() => setReplyTo({ id: comment.id, authorName: comment.author_name })}
            />
            {repliesOf(comment.id).length > 0 && (
              <ul className="ms-6 mt-2 space-y-2 border-e-2 border-border pe-3">
                {repliesOf(comment.id).map((reply) => (
                  <li key={reply.id}>
                    <CommentItem
                      comment={reply}
                      taskId={taskId}
                      currentUserId={currentUserId}
                      canDeleteAny={canDeleteAny}
                      onReply={() => setReplyTo({ id: comment.id, authorName: comment.author_name })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted">لا توجد تعليقات بعد</p>}
      </ul>

      <CommentForm
        taskId={taskId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        mentionableUsers={mentionableUsers}
      />
    </section>
  );
}

function CommentItem({
  comment,
  taskId,
  currentUserId,
  canDeleteAny,
  onReply,
}: {
  comment: TaskCommentWithAuthor;
  taskId: string;
  currentUserId: string;
  canDeleteAny: boolean;
  onReply: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthor = comment.user_id === currentUserId;

  async function saveEdit() {
    setPending(true);
    const result = await editComment(comment.id, taskId, content);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setError(null);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{comment.author_name}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-faint">
            {timeAgo(comment.created_at)}
            {comment.is_edited && " (تم التعديل)"}
          </span>
          <button type="button" onClick={onReply} className="text-accent-600 hover:underline">
            رد
          </button>
          {isAuthor && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-accent-600 hover:underline">
              تعديل
            </button>
          )}
          {(isAuthor || canDeleteAny) && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await deleteComment(comment.id, taskId);
                setPending(false);
              }}
              className="text-red-600 hover:underline disabled:opacity-60"
            >
              حذف
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={saveEdit}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setContent(comment.content);
                setError(null);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-background"
            >
              إلغاء
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-foreground/90">{comment.content}</p>
      )}

      {comment.mentioned_names.length > 0 && (
        <p className="mt-1.5 text-[12px] text-accent-600">
          @{comment.mentioned_names.join(" @")}
        </p>
      )}

      {comment.attachments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {comment.attachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-600 hover:underline"
                title={a.file_name}
              >
                <PaperclipIcon className="h-3.5 w-3.5" />
                {a.file_name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentForm({
  taskId,
  replyTo,
  onCancelReply,
  mentionableUsers,
}: {
  taskId: string;
  replyTo: { id: string; authorName: string } | null;
  onCancelReply: () => void;
  mentionableUsers: MentionableUser[];
}) {
  const [state, formAction, pending] = useActionState(addComment, initialState);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        // optimistic clear, not a success callback - if the action errors the
        // textarea has already emptied, an acceptable tradeoff for avoiding a
        // setState-in-effect keyed off `pending` finishing
        setMentioned([]);
        setShowMentionPicker(false);
        onCancelReply();
        requestAnimationFrame(() => formRef.current?.reset());
      }}
      className="space-y-2"
    >
      <input type="hidden" name="task_id" value={taskId} />
      {replyTo && <input type="hidden" name="parent_comment_id" value={replyTo.id} />}
      {mentioned.map((userId) => (
        <input key={userId} type="hidden" name="mentioned_user_id" value={userId} />
      ))}

      {replyTo && (
        <div className="flex items-center justify-between rounded-md bg-accent-50 px-3 py-1.5 text-xs text-accent-700">
          <span>الرد على: {replyTo.authorName}</span>
          <button type="button" onClick={onCancelReply} className="font-bold hover:underline">
            إلغاء
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <textarea
          name="content"
          rows={2}
          required
          placeholder="أضف تعليقًا..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          إرسال
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <input type="file" name="file" className="text-foreground" />
        {mentionableUsers.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMentionPicker((v) => !v)}
              className="rounded-full border border-border px-3 py-1 font-bold text-accent-600 hover:bg-accent-50"
            >
              @ إشارة
            </button>
            {showMentionPicker && (
              <div className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-surface p-2 shadow-lg">
                {mentionableUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-background">
                    <input
                      type="checkbox"
                      checked={mentioned.includes(u.id)}
                      onChange={(e) =>
                        setMentioned((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        )
                      }
                    />
                    {u.full_name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {mentioned.length > 0 && (
          <span className="text-accent-600">{mentioned.length} إشارة مضافة</span>
        )}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
