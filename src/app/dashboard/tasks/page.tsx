import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/dashboard/task-list";
import { PageHeader } from "@/components/shared/page-header";
import { CheckSquareIcon, PlusIcon } from "@/components/shared/icons";
import type { TaskStatus, TaskWithAssignee } from "@/lib/types/task";

const VALID_STATUSES: TaskStatus[] = ["new", "in_progress", "pending_review", "completed", "overdue", "cancelled"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const { status } = await searchParams;
  const initialFilter = status && VALID_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : "all";

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .returns<TaskWithAssignee[]>();

  return (
    <div>
      <PageHeader
        title="المهام"
        subtitle="كل المهام في مكان واحد"
        variant="navy"
        icon={<CheckSquareIcon className="h-6 w-6" />}
        count={`${tasks?.length ?? 0} مهمة`}
      >
        <Link
          href="/dashboard/tasks/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" />
          مهمة جديدة
        </Link>
      </PageHeader>

      <TaskList tasks={tasks ?? []} canDelete={profile.role === "super_admin"} initialFilter={initialFilter} />
    </div>
  );
}
