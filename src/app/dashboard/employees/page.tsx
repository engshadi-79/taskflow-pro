import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { EmployeesManager } from "@/components/dashboard/employees-manager";
import { computeEmployeeStats, type EmployeeStats } from "@/lib/employee-stats";
import type { Profile } from "@/lib/types/roles";

export default async function EmployeesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: employees }, { data: departments }, { data: tasks }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, organization_id, full_name, email, phone, role, department_id, job_title, is_active, created_at"
      )
      .order("created_at", { ascending: true })
      .returns<Profile[]>(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("tasks").select("assigned_to, status, created_at, updated_at"),
  ]);

  const stats: Record<string, EmployeeStats> = {};
  for (const employee of employees ?? []) {
    stats[employee.id] = computeEmployeeStats(tasks ?? [], employee.id);
  }

  return (
    <EmployeesManager
      employees={employees ?? []}
      departments={departments ?? []}
      stats={stats}
      currentUserId={profile.id}
      canManage={profile.role === "super_admin"}
    />
  );
}
