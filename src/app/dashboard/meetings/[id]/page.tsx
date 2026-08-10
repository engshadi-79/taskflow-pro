import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MeetingAttendees } from "@/components/dashboard/meeting-attendees";
import { MeetingAgenda } from "@/components/dashboard/meeting-agenda";
import { MeetingMinutes } from "@/components/dashboard/meeting-minutes";
import { MeetingAttachments } from "@/components/dashboard/meeting-attachments";
import { CalendarIcon } from "@/components/shared/icons";
import { updateMeetingStatus } from "@/lib/actions/meetings";
import {
  MEETING_STATUS_LABEL,
  type Meeting,
  type MeetingAgendaItem,
  type MeetingMinuteItem,
  type MeetingStatus,
} from "@/lib/types/meeting";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, organizer:users!meetings_organizer_id_fkey(full_name), project:projects(name)")
    .eq("id", id)
    .single<Meeting & { organizer: { full_name: string } | null; project: { name: string } | null }>();

  if (!meeting) {
    notFound();
  }

  const canManage = profile.role === "super_admin" || meeting.organizer_id === profile.id;

  const [
    { data: attendees },
    { data: agendaItems },
    { data: minuteItems },
    { data: attachments },
    { data: employees },
  ] = await Promise.all([
    supabase
      .from("meeting_attendees")
      .select("id, user:users(id, full_name, avatar_url)")
      .eq("meeting_id", id)
      .returns<{ id: string; user: { id: string; full_name: string; avatar_url: string | null } | null }[]>(),
    supabase
      .from("meeting_agenda_items")
      .select("*")
      .eq("meeting_id", id)
      .order("position", { ascending: true })
      .returns<MeetingAgendaItem[]>(),
    supabase
      .from("meeting_minutes_items")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true })
      .returns<MeetingMinuteItem[]>(),
    supabase
      .from("meeting_attachments")
      .select("*")
      .eq("meeting_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase.from("users").select("id, full_name").order("full_name"),
  ]);

  const attendeeIds = new Set((attendees ?? []).map((a) => a.user?.id).filter(Boolean));
  const nonAttendees = (employees ?? []).filter((e) => !attendeeIds.has(e.id));

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("task-attachments").createSignedUrl(a.file_url, 60 * 60);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/meetings" className="text-[12.5px] font-bold text-accent-600 hover:underline">
            ← الاجتماعات
          </Link>
          <h1 className="flex items-center gap-2.5 font-display text-[20px] text-foreground">
            <CalendarIcon className="h-5 w-5 text-accent-500" />
            {meeting.title}
          </h1>
          <p className="text-[13px] text-muted">
            {meeting.meeting_date}
            {meeting.meeting_time ? ` — ${meeting.meeting_time}` : ""}
            {meeting.location ? ` · ${meeting.location}` : ""}
            {meeting.project ? ` · مشروع: ${meeting.project.name}` : ""}
          </p>
        </div>
        {canManage ? (
          <StatusSelect meetingId={meeting.id} status={meeting.status} />
        ) : (
          <span className="rounded-full bg-accent-50 px-3.5 py-1.5 text-[12.5px] font-extrabold text-accent-600">
            {MEETING_STATUS_LABEL[meeting.status]}
          </span>
        )}
      </div>

      <Section title="الحضور">
        <MeetingAttendees
          meetingId={meeting.id}
          attendees={attendees ?? []}
          nonAttendees={nonAttendees}
          canManage={canManage}
        />
      </Section>

      <Section title="جدول الأعمال">
        <MeetingAgenda meetingId={meeting.id} items={agendaItems ?? []} canManage={canManage} />
      </Section>

      <Section title="المحضر">
        <MeetingMinutes
          meetingId={meeting.id}
          items={minuteItems ?? []}
          employees={employees ?? []}
          canManage={canManage}
        />
      </Section>

      <Section title="المرفقات">
        <MeetingAttachments
          meetingId={meeting.id}
          attachments={attachmentsWithUrls}
          currentUserId={profile.id}
          canDeleteAny={profile.role === "super_admin"}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
      <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function StatusSelect({ meetingId, status }: { meetingId: string; status: MeetingStatus }) {
  async function action(formData: FormData) {
    "use server";
    await updateMeetingStatus(meetingId, formData.get("status") as MeetingStatus);
  }

  return (
    <form action={action}>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-extrabold text-foreground outline-none focus:border-accent-500"
      >
        {(Object.keys(MEETING_STATUS_LABEL) as MeetingStatus[]).map((s) => (
          <option key={s} value={s}>
            {MEETING_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
