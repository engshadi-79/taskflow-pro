import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { AddToCalendar } from "@/components/shared/add-to-calendar";
import { MEETING_STATUS_LABEL, type Meeting, type MeetingAgendaItem, type MeetingMinuteItem } from "@/lib/types/meeting";
import type { EventTiming } from "@/lib/calendar-export";

const MEETING_GRADIENT = "linear-gradient(135deg, #12a894 0%, #3ecf7e 100%)";

export default async function MobileMeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", id).single<Meeting>();
  if (!meeting) notFound();

  const [{ data: attendees }, { data: agendaItems }, { data: minuteItems }] = await Promise.all([
    supabase
      .from("meeting_attendees")
      .select("id, user:users(id, full_name)")
      .eq("meeting_id", id)
      .returns<{ id: string; user: { id: string; full_name: string } | null }[]>(),
    supabase.from("meeting_agenda_items").select("*").eq("meeting_id", id).order("position", { ascending: true }).returns<MeetingAgendaItem[]>(),
    supabase.from("meeting_minutes_items").select("*").eq("meeting_id", id).order("created_at", { ascending: true }).returns<MeetingMinuteItem[]>(),
  ]);

  const meetingTiming: EventTiming = meeting.meeting_time
    ? (() => {
        const start = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
        return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
      })()
    : { allDay: true, date: new Date(`${meeting.meeting_date}T00:00:00`) };

  return (
    <div>
      <MobileHeader
        back
        gradient={MEETING_GRADIENT}
        subtitle="تفاصيل الاجتماع"
        title={meeting.title}
        chips={
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold text-white">
            {MEETING_STATUS_LABEL[meeting.status]}
          </span>
        }
      />

      <div className="flex flex-col gap-4.5 p-4">
        <p className="text-[12.5px] font-semibold text-muted">
          {meeting.meeting_date}
          {meeting.meeting_time ? ` · ${meeting.meeting_time.slice(0, 5)}` : ""}
          {meeting.location ? ` · ${meeting.location}` : ""}
        </p>

        <AddToCalendar id={meeting.id} title={meeting.title} location={meeting.location ?? undefined} timing={meetingTiming} />

        <div>
          <div className="mb-2.5 text-[13px] font-extrabold text-foreground">الحضور</div>
          <div className="flex flex-wrap gap-2">
            {(attendees ?? []).map((a) => (
              <span key={a.id} className="rounded-full bg-background px-3 py-1.5 text-[11.5px] font-bold text-foreground">
                {a.user?.full_name ?? "—"}
              </span>
            ))}
            {(attendees ?? []).length === 0 && <p className="text-[12.5px] text-muted">لا يوجد حضور مسجَّل</p>}
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[13px] font-extrabold text-foreground">جدول الأعمال</div>
          <div className="flex flex-col gap-2">
            {(agendaItems ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                <span className="text-[12.5px] font-semibold text-muted">{item.content}</span>
              </div>
            ))}
            {(agendaItems ?? []).length === 0 && <p className="text-[12.5px] text-muted">لا يوجد جدول أعمال</p>}
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[13px] font-extrabold text-foreground">المحضر</div>
          <div className="flex flex-col gap-2">
            {(minuteItems ?? []).map((item) => (
              <div key={item.id} className="rounded-[12px] bg-background p-3 text-[12.5px] leading-7 text-muted">
                {item.content}
              </div>
            ))}
            {(minuteItems ?? []).length === 0 && <p className="text-[12.5px] text-muted">لم يُضَف المحضر بعد</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
