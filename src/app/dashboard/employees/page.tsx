import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/foundation/permissions";
import { EmployeesManager } from "@/components/dashboard/employees-manager";
import { InviteManager, type InviteRow } from "@/components/dashboard/invite-manager";
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
  const canInvite = can.manageOrganization(profile);

  const [{ data: employees }, { data: departments }, { data: tasks }, { data: invites }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, organization_id, full_name, email, phone, role, department_id, job_title, avatar_url, is_active, created_at"
      )
      .order("created_at", { ascending: true })
      .returns<Profile[]>(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("tasks").select("assigned_to, status, created_at, updated_at"),
    canInvite
      ? supabase
          .from("organization_invites")
          .select("id, role, department_id, max_uses, use_count, expires_at, revoked_at")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const stats: Record<string, EmployeeStats> = {};
  for (const employee of employees ?? []) {
    stats[employee.id] = computeEmployeeStats(tasks ?? [], employee.id);
  }

  const departmentNameById = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const inviteRows: InviteRow[] = (invites ?? []).map((invite) => ({
    ...invite,
    department_name: invite.department_id ? (departmentNameById.get(invite.department_id) ?? null) : null,
  }));

  return (
    <div className="space-y-4.5">
      <EmployeesManager
        employees={employees ?? []}
        departments={departments ?? []}
        stats={stats}
        currentUserId={profile.id}
        canManage={profile.role === "super_admin"}
      />
      {canInvite && <InviteManager invites={inviteRows} departments={departments ?? []} />}
    </div>
  );
}
