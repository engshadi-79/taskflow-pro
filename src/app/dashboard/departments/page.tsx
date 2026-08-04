import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { DepartmentsManager } from "@/components/dashboard/departments-manager";
import type { DepartmentWithManager } from "@/lib/types/department";

export default async function DepartmentsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: departments }, { data: employees }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, organization_id, name, manager_id, created_at, manager:users!departments_manager_id_fkey(id, full_name)")
      .order("created_at", { ascending: true })
      .returns<DepartmentWithManager[]>(),
    supabase
      .from("users")
      .select("id, full_name, department_id")
      .order("full_name"),
  ]);

  const employeeCounts: Record<string, number> = {};
  for (const employee of employees ?? []) {
    if (employee.department_id) {
      employeeCounts[employee.department_id] =
        (employeeCounts[employee.department_id] ?? 0) + 1;
    }
  }

  return (
    <DepartmentsManager
      departments={departments ?? []}
      employees={(employees ?? []).map((e) => ({ id: e.id, full_name: e.full_name }))}
      employeeCounts={employeeCounts}
    />
  );
}
