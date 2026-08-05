import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { PageHeader } from "@/components/shared/page-header";
import { BoardIcon } from "@/components/shared/icons";
import type { TaskWithAssignee } from "@/lib/types/task";

export default async function KanbanPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .returns<TaskWithAssignee[]>();

  const canManage = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <PageHeader
        title="لوحة كانبان"
        subtitle="اسحب وأفلت المهام بين الحالات لتحديثها فوراً"
        variant="teal"
        icon={<BoardIcon className="h-6 w-6" />}
        count={`${tasks?.length ?? 0} مهمة`}
      />

      <KanbanBoard tasks={tasks ?? []} canManage={canManage} currentUserId={profile.id} />
    </div>
  );
}
