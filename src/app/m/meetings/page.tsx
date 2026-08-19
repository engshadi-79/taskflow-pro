import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MEETING_STATUS_LABEL, type Meeting } from "@/lib/types/meeting";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-accent-50 text-accent-700",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted line-through",
};

export default async function MobileMeetingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false })
    .returns<Meeting[]>();

  return (
    <div>
      <MobileHeader title="الاجتماعات" subtitle={`${meetings?.length ?? 0} اجتماع`} />
      <div className="flex flex-col gap-2.5 px-4 pb-6">
        {(meetings ?? []).map((m) => (
          <Link key={m.id} href={`/m/meetings/${m.id}`} className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-[13.5px] font-bold text-foreground">{m.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${STATUS_BADGE[m.status]}`}>
                {MEETING_STATUS_LABEL[m.status]}
              </span>
            </div>
            <div className="mt-2 text-[11.5px] font-semibold text-muted">
              {m.meeting_date}
              {m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : ""}
              {m.location ? ` · ${m.location}` : ""}
            </div>
          </Link>
        ))}
        {(meetings ?? []).length === 0 && <p className="py-10 text-center text-[13px] text-muted">لا توجد اجتماعات بعد</p>}
      </div>
    </div>
  );
}
