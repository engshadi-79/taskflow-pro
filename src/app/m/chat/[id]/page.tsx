import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileChatThread } from "@/components/mobile/mobile-chat-thread";
import type { ConversationSummary } from "@/lib/types/chat";

export default async function MobileChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.rpc("conversations_with_last_message");
  const conversations = (data as unknown as ConversationSummary[] | null) ?? [];
  const conversation = conversations.find((c) => c.conversation_id === id);
  const title = conversation ? (conversation.type === "group" ? conversation.name : conversation.other_user_name) ?? "محادثة" : "محادثة";

  return (
    <div>
      <MobileHeader back title={title} />
      <MobileChatThread conversationId={id} currentUserId={profile.id} />
    </div>
  );
}
