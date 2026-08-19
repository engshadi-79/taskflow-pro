import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileTaskList } from "@/components/mobile/mobile-task-list";
import type { TaskWithAssignee } from "@/lib/types/task";

export default async function MobileTasksPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
    .order("created_at", { ascending: false });

  // Desktop keeps this list manager/admin-only; mobile is meant for daily
  // hands-on use, so an employee sees their own tasks here instead of being
  // redirected away.
  if (profile.role === "employee") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data: tasks } = await query.returns<TaskWithAssignee[]>();

  return (
    <div>
      <MobileHeader title="المهام" />
      <MobileTaskList tasks={tasks ?? []} />
    </div>
  );
}
