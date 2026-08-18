import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClipboardIcon, InboxIcon } from "@/components/shared/icons";
import { InventoryDailyRow } from "@/components/dashboard/inventory-daily-row";
import { InventoryToolsManager } from "@/components/dashboard/inventory-tools-manager";
import type { InventoryDailyCheck, InventoryTool, InventoryTrack } from "@/lib/types/inventory";

type TrackWithResponsible = InventoryTrack & { responsible: { id: string; full_name: string } | null };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; date?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const supabase = await createClient();
  const isSuperAdmin = profile.role === "super_admin";

  // RLS already scopes this to every track for super_admin, or only the
  // track(s) this specific employee is responsible for - never by
  // department, since tracks aren't department-scoped.
  const [{ data: tracksRaw }, { data: employees }] = await Promise.all([
    supabase
      .from("inventory_tracks")
      .select("*, responsible:users!inventory_tracks_responsible_user_id_fkey(id, full_name)")
      .order("name")
      .returns<TrackWithResponsible[]>(),
    isSuperAdmin
      ? supabase.from("users").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const tracks = tracksRaw ?? [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedDate = params.date && params.date <= todayIso ? params.date : todayIso;
  const selectedTrackId =
    params.track && tracks.some((t) => t.id === params.track) ? params.track : (tracks[0]?.id ?? null);
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;

  let tools: InventoryTool[] = [];
  let checks: InventoryDailyCheck[] = [];
  if (selectedTrackId) {
    const { data: toolsData } = await supabase
      .from("inventory_tools")
      .select("*")
      .eq("track_id", selectedTrackId)
      .order("position")
      .returns<InventoryTool[]>();
    tools = toolsData ?? [];

    if (tools.length > 0) {
      const { data: checksData } = await supabase
        .from("inventory_daily_checks")
        .select("*")
        .eq("check_date", selectedDate)
        .in(
          "tool_id",
          tools.map((t) => t.id)
        )
        .returns<InventoryDailyCheck[]>();
      checks = checksData ?? [];
    }
  }

  const checkByToolId = new Map(checks.map((c) => [c.tool_id, c]));
  const isResponsible = selectedTrack?.responsible_user_id === profile.id;
  const canEditToday = selectedDate === todayIso && (isSuperAdmin || isResponsible);

  const prevDate = new Date(`${selectedDate}T00:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(`${selectedDate}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateIso = nextDate.toISOString().slice(0, 10);

  function dateLink(trackId: string, date: string) {
    return `/dashboard/inventory?track=${trackId}&date=${date}`;
  }

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="جرد الأدوات"
        subtitle="عدّ صباحي ومسائي وكمية فعلية لكل أداة، حسب المسار المسؤول عنه كل موظف"
        variant="navy"
        icon={<ClipboardIcon className="h-6 w-6" />}
      />

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[18px] border border-border bg-surface p-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
            <InboxIcon className="h-5 w-5" />
          </span>
          <p className="text-[13px] text-muted">لا يوجد مسار جرد مسنَد إليك</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-border bg-surface p-3">
            {tracks.map((track) => (
              <Link
                key={track.id}
                href={dateLink(track.id, selectedDate)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                  track.id === selectedTrackId
                    ? "bg-accent-500 text-white"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {track.name}
                {isSuperAdmin && (
                  <span className="ms-1.5 opacity-75">
                    ({track.responsible?.full_name ?? "غير مسنَد"})
                  </span>
                )}
              </Link>
            ))}
          </div>

          {selectedTrack && (
            <>
              {isSuperAdmin && (
                <InventoryToolsManager
                  track={selectedTrack}
                  tools={tools}
                  employees={employees ?? []}
                />
              )}

              <div className="rounded-[18px] border border-border bg-surface p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[14.5px] font-extrabold text-foreground">
                    جرد {selectedTrack.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Link
                      href={dateLink(selectedTrack.id, prevDate.toISOString().slice(0, 10))}
                      className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-muted hover:border-accent-500 hover:text-accent-600"
                    >
                      ← اليوم السابق
                    </Link>
                    <span className="rounded-full bg-background px-3.5 py-1.5 text-[12.5px] font-extrabold text-foreground">
                      {selectedDate}
                      {selectedDate === todayIso && " (اليوم)"}
                    </span>
                    {nextDateIso <= todayIso && (
                      <Link
                        href={dateLink(selectedTrack.id, nextDateIso)}
                        className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-muted hover:border-accent-500 hover:text-accent-600"
                      >
                        اليوم التالي →
                      </Link>
                    )}
                  </div>
                </div>

                {tools.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-muted">لا توجد أدوات في هذا المسار بعد</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-faint">
                        <tr>
                          <th className="px-2 py-2 text-start">الأداة</th>
                          <th className="px-2 py-2 text-start">الكمية الكلية</th>
                          <th className="px-2 py-2 text-start">صباحي</th>
                          <th className="px-2 py-2 text-start">مسائي</th>
                          <th className="px-2 py-2 text-start">الكمية الفعلية</th>
                          {canEditToday && <th className="px-2 py-2 text-start">حفظ</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {tools.map((tool) => (
                          <InventoryDailyRow
                            key={tool.id}
                            tool={tool}
                            check={checkByToolId.get(tool.id) ?? null}
                            date={selectedDate}
                            editable={canEditToday}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
