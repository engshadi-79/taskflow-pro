import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { MeetingDeleteButton } from "@/components/dashboard/meeting-delete-button";
import { CalendarIcon, PlusIcon } from "@/components/shared/icons";
import { MEETING_STATUS_LABEL, type Meeting } from "@/lib/types/meeting";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-accent-50 text-accent-700",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted line-through",
};

export default async function MeetingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false })
    .returns<Meeting[]>();

  // organizer names come from a SECURITY DEFINER RPC, not a plain embedded
  // join - users_select restricts a viewer to their own department, which
  // would silently null out the organizer for any cross-department meeting
  // (see meeting_fixes.sql for the full reasoning)
  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: organizerRows } = meetingIds.length
    ? await supabase.rpc("meetings_organizer_names", { p_meeting_ids: meetingIds })
    : { data: [] };
  const organizerNameById = new Map(
    ((organizerRows as { meeting_id: string; organizer_name: string }[] | null) ?? []).map((r) => [
      r.meeting_id,
      r.organizer_name,
    ])
  );

  const canCreate = profile.role === "super_admin" || profile.role === "department_manager";

  return (
    <div>
      <PageHeader
        title="الاجتماعات"
        subtitle="جدول الأعمال والمحاضر في مكان واحد"
        variant="teal"
        icon={<CalendarIcon className="h-6 w-6" />}
        count={`${meetings?.length ?? 0} اجتماع`}
      >
        {canCreate && (
          <Link
            href="/dashboard/meetings/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-accent-700 transition-transform hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" />
            اجتماع جديد
          </Link>
        )}
      </PageHeader>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-1.5 py-4 text-start">الاجتماع</th>
              <th className="px-1.5 py-4 text-start">المنظِّم</th>
              <th className="px-1.5 py-4 text-start">التاريخ</th>
              <th className="px-1.5 py-4 text-start">المكان</th>
              <th className="px-1.5 py-4 text-start">الحالة</th>
              <th className="px-1.5 py-4 text-start">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(meetings ?? []).map((m) => {
              const canManageThis = profile.role === "super_admin" || m.organizer_id === profile.id;
              return (
                <tr key={m.id} className="border-t border-border transition-colors hover:bg-background">
                  <td className="px-1.5 py-3">
                    <Link href={`/dashboard/meetings/${m.id}`} className="font-medium text-foreground hover:text-accent-600">
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-1.5 py-3 text-muted">{organizerNameById.get(m.id) ?? "—"}</td>
                  <td className="px-1.5 py-3 text-muted">
                    {m.meeting_date}
                    {m.meeting_time ? ` — ${m.meeting_time}` : ""}
                  </td>
                  <td className="px-1.5 py-3 text-muted">{m.location ?? "—"}</td>
                  <td className="px-1.5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[m.status]}`}>
                      {MEETING_STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-1.5 py-3">
                    <div className="flex items-center gap-3">
                      {canManageThis && (
                        <Link
                          href={`/dashboard/meetings/${m.id}/edit`}
                          className="text-[12.5px] font-bold text-accent-600 hover:underline"
                        >
                          تعديل
                        </Link>
                      )}
                      {profile.role === "super_admin" && <MeetingDeleteButton meetingId={m.id} />}
                      {!canManageThis && profile.role !== "super_admin" && (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(meetings ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
                      <CalendarIcon className="h-5 w-5" />
                    </span>
                    <p className="text-[13px] text-muted">لا توجد اجتماعات بعد</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
