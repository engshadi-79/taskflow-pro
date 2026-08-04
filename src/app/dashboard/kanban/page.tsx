import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
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
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[22px] text-foreground">لوحة كانبان</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          اسحب المهام بين الأعمدة لتحديث حالتها — {tasks?.length ?? 0} مهمة
        </p>
      </div>
      <KanbanBoard tasks={tasks ?? []} canManage={canManage} currentUserId={profile.id} />
    </div>
  );
}
