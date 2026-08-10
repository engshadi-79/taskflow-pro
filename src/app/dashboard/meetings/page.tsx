import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
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
    .select("*, organizer:users!meetings_organizer_id_fkey(full_name)")
    .order("meeting_date", { ascending: false })
    .returns<(Meeting & { organizer: { full_name: string } | null })[]>();

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
            </tr>
          </thead>
          <tbody>
            {(meetings ?? []).map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-1.5 py-3">
                  <Link href={`/dashboard/meetings/${m.id}`} className="font-medium text-foreground hover:text-accent-600">
                    {m.title}
                  </Link>
                </td>
                <td className="px-1.5 py-3 text-muted">{m.organizer?.full_name ?? "—"}</td>
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
              </tr>
            ))}
            {(meetings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  لا توجد اجتماعات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
