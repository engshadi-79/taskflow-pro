import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import type { ConversationSummary } from "@/lib/types/chat";

export default async function MobileChatListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.rpc("conversations_with_last_message");
  const conversations = (data as unknown as ConversationSummary[] | null) ?? [];

  return (
    <div>
      <MobileHeader title="المحادثات" />
      <div className="flex flex-col px-4 pb-6">
        {conversations.map((c) => {
          const title = c.type === "group" ? c.name : c.other_user_name;
          return (
            <Link
              key={c.conversation_id}
              href={`/m/chat/${c.conversation_id}`}
              className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[14px] font-extrabold text-white">
                {title?.[0] ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-bold text-foreground">{title ?? "محادثة"}</span>
                  {c.last_message_at && (
                    <span className="shrink-0 text-[11px] font-semibold text-faint">
                      {new Date(c.last_message_at).toLocaleDateString("ar")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[12px] font-semibold text-muted">{c.last_message ?? "لا توجد رسائل بعد"}</div>
              </div>
              {c.unread_count > 0 && (
                <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10.5px] font-extrabold text-white">
                  {c.unread_count}
                </span>
              )}
            </Link>
          );
        })}
        {conversations.length === 0 && <p className="py-10 text-center text-[13px] text-muted">لا توجد محادثات بعد</p>}
      </div>
    </div>
  );
}
