import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
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
  const { data: employees } = await supabase
    .from("users")
    .select("id, full_name")
    .order("full_name");

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">مهمة جديدة</h1>
      <TaskForm employees={employees ?? []} action={createTask} />
    </div>
  );
}
