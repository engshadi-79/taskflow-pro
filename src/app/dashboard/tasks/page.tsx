import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/dashboard/task-list";
import type { TaskWithAssignee } from "@/lib/types/task";

export default async function TasksPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .returns<TaskWithAssignee[]>();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] text-foreground">المهام</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            كل المهام في مكان واحد — {tasks?.length ?? 0} مهمة
          </p>
        </div>
        <Link
          href="/dashboard/tasks/new"
          className="rounded-[10px] bg-accent-500 px-5 py-2.5 text-[13.5px] font-extrabold text-white hover:bg-accent-600"
        >
          + مهمة جديدة
        </Link>
      </div>
      <TaskList tasks={tasks ?? []} canDelete={profile.role === "super_admin"} />
    </div>
  );
}
