import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/dashboard/task-form";
import { createTask } from "@/lib/actions/tasks";

export default async function NewTaskPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: employees }, { data: projects }, organization] = await Promise.all([
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase
      .from("projects")
      .select("id, name, milestones:project_milestones(id, title)")
      .order("name"),
    getCurrentOrganization(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">مهمة جديدة</h1>
      <TaskForm
        employees={employees ?? []}
        projects={projects ?? []}
        action={createTask}
        defaultPriority={organization?.default_task_priority}
      />
    </div>
  );
}
