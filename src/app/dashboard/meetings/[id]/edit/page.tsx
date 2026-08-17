import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MeetingForm } from "@/components/dashboard/meeting-form";
import type { Meeting } from "@/lib/types/meeting";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", id).single<Meeting>();

  if (!meeting) {
    notFound();
  }

  const canManage = profile.role === "super_admin" || meeting.organizer_id === profile.id;
  if (!canManage) {
    redirect(`/dashboard/meetings/${id}`);
  }

  const [{ data: employees }, { data: projects }] = await Promise.all([
    supabase.from("users").select("id, full_name").order("full_name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-[22px] text-foreground">تعديل الاجتماع</h1>
      <MeetingForm meeting={meeting} employees={employees ?? []} projects={projects ?? []} />
    </div>
  );
}
