import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ChatIcon } from "@/components/shared/icons";
import { ChatApp } from "@/components/dashboard/chat-app";
import type { ConversationSummary, OrgMemberDirectoryEntry } from "@/lib/types/chat";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: conversationsRaw }, { data: directoryRaw }] = await Promise.all([
    supabase.rpc("conversations_with_last_message"),
    supabase.rpc("org_members_directory"),
  ]);
  const conversations = conversationsRaw as unknown as ConversationSummary[] | null;
  const directory = directoryRaw as unknown as OrgMemberDirectoryEntry[] | null;

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="المحادثات"
        subtitle="محادثات فردية وجماعية بين موظفي مؤسستك"
        variant="teal"
        icon={<ChatIcon className="h-6 w-6" />}
      />
      <ChatApp
        currentUserId={profile.id}
        initialConversations={conversations ?? []}
        directory={directory ?? []}
        initialSelectedId={params.c ?? null}
      />
    </div>
  );
}
