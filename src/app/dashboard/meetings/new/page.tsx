import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MeetingForm } from "@/components/dashboard/meeting-form";

export default async function NewMeetingPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "super_admin" && profile.role !== "department_manager") {
    redirect("/dashboard/meetings");
  }

  const supabase = await createClient();
  const [{ data: employees }, { data: projects }] = await Promise.all([
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">اجتماع جديد</h1>
      <MeetingForm employees={employees ?? []} projects={projects ?? []} />
    </div>
  );
}
