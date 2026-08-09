import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/dashboard/project-form";

export default async function NewProjectPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard/projects");
  }

  const supabase = await createClient();
  const [{ data: employees }, { data: departments }] = await Promise.all([
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase.from("departments").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">مشروع جديد</h1>
      <ProjectForm
        employees={employees ?? []}
        departments={departments ?? []}
        isSuperAdmin={profile.role === "super_admin"}
      />
    </div>
  );
}
