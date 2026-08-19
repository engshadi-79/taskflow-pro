import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileKanbanBoard } from "@/components/mobile/mobile-kanban-board";
import type { TaskWithAssignee } from "@/lib/types/task";

export default async function MobileKanbanPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: filteredTasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
    .neq("status", "cancelled")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .returns<TaskWithAssignee[]>();

  // Same defensive fallback as the desktop Kanban page: an org whose DB
  // predates task_archiving.sql doesn't have is_archived at all yet.
  let tasks = filteredTasks;
  if (tasksError?.code === "42703") {
    ({ data: tasks } = await supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<TaskWithAssignee[]>());
  }

  const canManage = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <MobileHeader title="لوحة كانبان" />
      <MobileKanbanBoard tasks={tasks ?? []} canManage={canManage} currentUserId={profile.id} />
    </div>
  );
}
