"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { assignTrackProject, assignTrackResponsible, updateDailyCheckField } from "@/lib/actions/inventory";
import { InventoryDailyRow, type DailyCheckValue } from "@/components/dashboard/inventory-daily-row";
import { InventoryToolsManager } from "@/components/dashboard/inventory-tools-manager";
import { InventoryProgressRing } from "@/components/dashboard/inventory-progress-ring";
import { INVENTORY_THEME_VARS } from "@/lib/inventory-status";
import type { InventoryDailyCheck, InventoryTool, InventoryTrack } from "@/lib/types/inventory";

type EmployeeOption = { id: string; full_name: string };
type TrackWithResponsible = InventoryTrack & { responsible: { id: string; full_name: string } | null };

const DOW_AR: Record<number, string> = {
  0: "الأحد",
  1: "الاثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};

function dowLabel(dateStr: string) {
  return DOW_AR[new Date(`${dateStr}T00:00:00`).getDay()];
}

function toValuesMap(tools: InventoryTool[], checks: InventoryDailyCheck[]): Record<string, DailyCheckValue> {
  const byTool = new Map(checks.map((c) => [c.tool_id, c]));
  const map: Record<string, DailyCheckValue> = {};
  for (const tool of tools) {
    const c = byTool.get(tool.id);
    map[tool.id] = {
      morning: c?.morning_checked ?? false,
      evening: c?.evening_checked ?? false,
      actual: c?.actual_quantity ?? "",
    };
  }
  return map;
}

/** One linked track's full inventory - a mode switch between the daily
 * صباحي/مسائي/الفعلية check grid and the (super_admin-only) fixed tool
 * list, styled apart from the rest of the app in the reference design's
 * emerald/gold "official certificate" palette. */
export function InventoryTrackPanel({
  track,
  tools,
  initialChecks,
  todayIso,
  isSuperAdmin,
  currentUserId,
  employees,
}: {
  track: TrackWithResponsible;
  tools: InventoryTool[];
  initialChecks: InventoryDailyCheck[];
  todayIso: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  employees: EmployeeOption[];
}) {
  const [mode, setMode] = useState<"daily" | "manage">("daily");
  const [date, setDate] = useState(todayIso);
  const [todayValues, setTodayValues] = useState(() => toValuesMap(tools, initialChecks));
  const [historical, setHistorical] = useState<{ date: string; values: Record<string, DailyCheckValue> } | null>(null);
  const [search, setSearch] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (date === todayIso) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("inventory_daily_checks")
      .select("*")
      .eq("check_date", date)
      .in(
        "tool_id",
        tools.map((t) => t.id)
      )
      .returns<InventoryDailyCheck[]>()
      .then(({ data }) => {
        if (cancelled) return;
        setHistorical({ date, values: toValuesMap(tools, data ?? []) });
      });
    return () => {
      cancelled = true;
    };
  }, [date, todayIso, tools]);

  const isToday = date === todayIso;
  const loadingHistorical = !isToday && historical?.date !== date;
  const values = isToday ? todayValues : historical?.date === date ? historical.values : {};
  const isResponsible = track.responsible_user_id === currentUserId;
  const editable = isToday && (isSuperAdmin || isResponsible);

  async function handleFieldChange(toolId: string, field: "morning" | "evening" | "actual", value: boolean | string) {
    setTodayValues((prev) => ({ ...prev, [toolId]: { ...prev[toolId], [field]: value } }));
    const dbField = field === "morning" ? "morning_checked" : field === "evening" ? "evening_checked" : "actual_quantity";
    const result = await updateDailyCheckField(toolId, date, dbField, value);
    setRowErrors((prev) => ({ ...prev, [toolId]: result?.error ?? "" }));
  }

  async function handleMarkAllMorning() {
    const ids = tools.map((t) => t.id);
    setTodayValues((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { ...next[id], morning: true };
      return next;
    });
    await Promise.all(ids.map((id) => updateDailyCheckField(id, date, "morning_checked", true)));
  }

  async function handleAssignResponsible(userId: string) {
    setAssigning(true);
    setAssignError(null);
    const result = await assignTrackResponsible(track.id, userId || null);
    setAssigning(false);
    if (result?.error) setAssignError(result.error);
  }

  async function handleUnlink() {
    if (!confirm(`إلغاء ربط "${track.name}" بهذا المشروع؟`)) return;
    setUnlinking(true);
    await assignTrackProject(track.id, null);
    setUnlinking(false);
  }

  const filteredTools = search.trim()
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          (t.group_label ?? "").toLowerCase().includes(search.trim().toLowerCase())
      )
    : tools;

  const total = tools.length;
  let morningCount = 0;
  let eveningCount = 0;
  let doneCount = 0;
  let mismatches = 0;
  for (const tool of tools) {
    const v = values[tool.id];
    if (!v) continue;
    if (v.morning) morningCount++;
    if (v.evening) eveningCount++;
    if (v.actual) {
      doneCount++;
      const tn = tool.total_quantity !== null ? parseFloat(tool.total_quantity) : NaN;
      const an = parseFloat(v.actual);
      if (!isNaN(tn) && !isNaN(an) && an !== tn) mismatches++;
    }
  }
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div style={INVENTORY_THEME_VARS} className="overflow-hidden rounded-[18px] border border-[var(--inv-line,#e4e0d2)] shadow-sm">
      {/* header */}
      <div className="bg-gradient-to-br from-[var(--inv-emerald-950)] to-[var(--inv-emerald-800)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-white">جرد {track.name}</h3>
            <p className="mt-0.5 text-[12px] text-white/65">
              {track.responsible?.full_name ? `المسؤول: ${track.responsible.full_name}` : "بدون مسؤول محدَّد"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isSuperAdmin && (
              <>
                <select
                  defaultValue={track.responsible_user_id ?? ""}
                  disabled={assigning}
                  onChange={(e) => handleAssignResponsible(e.target.value)}
                  className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[12px] text-white outline-none disabled:opacity-60"
                >
                  <option value="" className="text-[var(--ink,#1c2b23)]">بدون مسؤول</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id} className="text-[var(--ink,#1c2b23)]">
                      {e.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={unlinking}
                  onClick={handleUnlink}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-bold text-white/85 hover:bg-white/20 disabled:opacity-60"
                >
                  إلغاء الربط بالمشروع
                </button>
              </>
            )}
          </div>
        </div>
        {assignError && <p className="mt-2 text-[12px] text-[var(--inv-gold-light)]">{assignError}</p>}
      </div>

      <div className="space-y-4 bg-[#fbfaf5] p-4">
        {/* mode switch + date nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-[12px] border border-[var(--inv-line,#e4e0d2)] bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("daily")}
              className={`rounded-[9px] px-4 py-2 font-display text-[13px] font-bold transition-colors ${
                mode === "daily" ? "bg-[var(--inv-emerald-900)] text-white" : "text-[var(--muted,#6c7a70)]"
              }`}
            >
              الجرد اليومي
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setMode("manage")}
                className={`rounded-[9px] px-4 py-2 font-display text-[13px] font-bold transition-colors ${
                  mode === "manage" ? "bg-[var(--inv-emerald-900)] text-white" : "text-[var(--muted,#6c7a70)]"
                }`}
              >
                إدارة المواد
              </button>
            )}
          </div>

          {mode === "daily" && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[var(--inv-line,#e4e0d2)] bg-white p-1.5 shadow-sm">
              <button
                type="button"
                title="اليوم السابق"
                onClick={() => {
                  const d = new Date(`${date}T00:00:00`);
                  d.setDate(d.getDate() - 1);
                  setDate(d.toISOString().slice(0, 10));
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--inv-emerald-800)] hover:bg-[var(--inv-emerald-900)] hover:text-white"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                max={todayIso}
                onChange={(e) => setDate(e.target.value)}
                className="border-none bg-transparent px-1.5 text-[13px] font-medium text-[var(--ink,#1c2b23)] outline-none"
              />
              <span className="border-e border-[var(--inv-line,#e4e0d2)] px-2 font-display text-[12px] font-extrabold text-[var(--inv-emerald-800)]">
                {dowLabel(date)}
              </span>
              <button
                type="button"
                title="اليوم التالي"
                disabled={isToday}
                onClick={() => {
                  const d = new Date(`${date}T00:00:00`);
                  d.setDate(d.getDate() + 1);
                  const next = d.toISOString().slice(0, 10);
                  if (next <= todayIso) setDate(next);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--inv-emerald-800)] hover:bg-[var(--inv-emerald-900)] hover:text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {mode === "daily" ? (
          <>
            {/* summary row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex items-center gap-3.5 rounded-[14px] bg-gradient-to-br from-[var(--inv-emerald-900)] to-[var(--inv-emerald-800)] p-3.5 text-white shadow-sm">
                <InventoryProgressRing percent={percent} />
                <div>
                  <div className="font-display text-[13.5px] font-extrabold">إنجاز جرد اليوم</div>
                  <div className="mt-0.5 text-[11px] text-white/65">{doneCount} من {total} مادة مُدخَلة</div>
                </div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div className="font-display text-[22px] font-extrabold text-[var(--inv-emerald-900)]">{morningCount}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">فحص صباحي مُنجز</div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div className="font-display text-[22px] font-extrabold text-[var(--inv-emerald-900)]">{eveningCount}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">فحص مسائي مُنجز</div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div
                  className="font-display text-[22px] font-extrabold"
                  style={{ color: mismatches > 0 ? "var(--inv-bad)" : "var(--inv-ok)" }}
                >
                  {mismatches}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">فروقات بالكمية</div>
              </div>
            </div>

            {/* search + bulk action */}
            <div className="flex flex-wrap gap-2.5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن مادة…"
                className="min-w-[220px] flex-1 rounded-[11px] border border-[var(--inv-line,#e4e0d2)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink,#1c2b23)] outline-none focus:border-[var(--inv-emerald-700)]"
              />
              {editable && (
                <button
                  type="button"
                  onClick={handleMarkAllMorning}
                  className="rounded-[11px] border border-[var(--inv-line,#e4e0d2)] bg-white px-4 py-2.5 font-display text-[13px] font-bold text-[var(--inv-emerald-900)] hover:border-[var(--inv-emerald-700)]"
                >
                  تحديد الكل (صباحي)
                </button>
              )}
            </div>

            {/* table */}
            <div className="overflow-hidden overflow-x-auto rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white">
              {filteredTools.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[var(--muted,#6c7a70)]">لا نتائج مطابقة للبحث</p>
              ) : loadingHistorical ? (
                <p className="py-10 text-center text-[13px] text-[var(--muted,#6c7a70)]">جارٍ التحميل...</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--inv-emerald-900)] text-white">
                      <th className="w-9 px-2.5 py-3 font-display text-[12px] font-bold">م</th>
                      <th className="px-2.5 py-3 text-start font-display text-[12px] font-bold">اسم المادة</th>
                      <th className="px-2.5 py-3 font-display text-[12px] font-bold">الكلية</th>
                      <th className="px-2.5 py-3 font-display text-[12px] font-bold">صباحي</th>
                      <th className="px-2.5 py-3 font-display text-[12px] font-bold">مسائي</th>
                      <th className="px-2.5 py-3 font-display text-[12px] font-bold">الفعلية</th>
                      <th className="px-2.5 py-3 font-display text-[12px] font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lastGroup: string | null | undefined;
                      return filteredTools.map((tool, index) => {
                        const groupRow =
                          tool.group_label !== lastGroup ? (
                            <tr key={`group-${tool.id}`} className="bg-[var(--inv-idle-bg)]">
                              <td colSpan={7} className="px-4 py-2 text-start font-display text-[11.5px] font-extrabold text-[var(--inv-emerald-800)]">
                                {tool.group_label}
                              </td>
                            </tr>
                          ) : null;
                        lastGroup = tool.group_label;
                        return (
                          <Fragment key={tool.id}>
                            {groupRow}
                            <InventoryDailyRow
                              index={index}
                              tool={tool}
                              value={values[tool.id] ?? { morning: false, evening: false, actual: "" }}
                              editable={editable}
                              onChange={(field, value) => handleFieldChange(tool.id, field, value)}
                              error={rowErrors[tool.id]}
                            />
                          </Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              )}
            </div>
            <p className="flex items-center gap-2 rounded-[10px] border border-dashed border-[var(--inv-line,#e4e0d2)] bg-white px-3.5 py-2.5 text-[12px] text-[var(--muted,#6c7a70)]">
              💡 حدد صباحي/مسائي عند فحص المادة فعليًا، وأدخل الكمية الفعلية المتوفرة. يُحفظ كل تغيير تلقائيًا لهذا اليوم بالذات.
            </p>
          </>
        ) : (
          <InventoryToolsManager trackId={track.id} tools={tools} />
        )}
      </div>
    </div>
  );
}
