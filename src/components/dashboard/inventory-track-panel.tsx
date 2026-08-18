"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { assignTrackProject, assignTrackResponsible, updateDailyCheckField } from "@/lib/actions/inventory";
import {
  InventoryFixedRow,
  InventoryConsumableRow,
  type ConsumableCheckValue,
  type FixedCheckValue,
} from "@/components/dashboard/inventory-daily-row";
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

function toFixedValues(tools: InventoryTool[], checks: InventoryDailyCheck[]): Record<string, FixedCheckValue> {
  const byTool = new Map(checks.map((c) => [c.tool_id, c]));
  const map: Record<string, FixedCheckValue> = {};
  for (const tool of tools) {
    const c = byTool.get(tool.id);
    map[tool.id] = { found: c?.found_quantity ?? "", notes: c?.notes ?? "" };
  }
  return map;
}

function toConsumableValues(
  tools: InventoryTool[],
  checks: InventoryDailyCheck[],
  defaultOpeningByTool: Record<string, string>
): Record<string, ConsumableCheckValue> {
  const byTool = new Map(checks.map((c) => [c.tool_id, c]));
  const map: Record<string, ConsumableCheckValue> = {};
  for (const tool of tools) {
    const c = byTool.get(tool.id);
    map[tool.id] = {
      opening: c?.opening_balance ?? defaultOpeningByTool[tool.id] ?? tool.total_quantity ?? "",
      used: c?.used_quantity ?? "",
      damaged: c?.damaged_lost_quantity ?? "",
      notes: c?.notes ?? "",
    };
  }
  return map;
}

/** One linked track's full inventory - a mode switch between the daily
 * check grid (split into أدوات ثابتة vs مواد مستهلكة, each with its own
 * columns) and the (super_admin-only) fixed/consumable tool list, styled
 * apart from the rest of the app in the reference design's emerald/gold
 * "official certificate" palette. */
export function InventoryTrackPanel({
  track,
  tools,
  initialChecks,
  defaultOpeningByTool,
  todayIso,
  isSuperAdmin,
  currentUserId,
  employees,
}: {
  track: TrackWithResponsible;
  tools: InventoryTool[];
  initialChecks: InventoryDailyCheck[];
  /** consumable tool_id -> opening balance carried from the most recent
   * prior day's own computed remainder (or the tool's total_quantity if
   * this is the very first day it's ever been checked). */
  defaultOpeningByTool: Record<string, string>;
  todayIso: string;
  isSuperAdmin: boolean;
  currentUserId: string;
  employees: EmployeeOption[];
}) {
  const fixedTools = tools.filter((t) => t.item_type === "fixed");
  const consumableTools = tools.filter((t) => t.item_type === "consumable");

  const [mode, setMode] = useState<"daily" | "manage">("daily");
  const [date, setDate] = useState(todayIso);
  const [fixedValues, setFixedValues] = useState(() => toFixedValues(fixedTools, initialChecks));
  const [consumableValues, setConsumableValues] = useState(() =>
    toConsumableValues(consumableTools, initialChecks, defaultOpeningByTool)
  );
  const [historical, setHistorical] = useState<{
    date: string;
    fixed: Record<string, FixedCheckValue>;
    consumable: Record<string, ConsumableCheckValue>;
  } | null>(null);
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
        const checks = data ?? [];
        setHistorical({
          date,
          fixed: toFixedValues(fixedTools, checks),
          consumable: toConsumableValues(consumableTools, checks, {}),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, todayIso]);

  const isToday = date === todayIso;
  const loadingHistorical = !isToday && historical?.date !== date;
  const fixedShown = isToday ? fixedValues : historical?.date === date ? historical.fixed : {};
  const consumableShown = isToday ? consumableValues : historical?.date === date ? historical.consumable : {};
  const isResponsible = track.responsible_user_id === currentUserId;
  const editable = isToday && (isSuperAdmin || isResponsible);

  async function handleFixedChange(toolId: string, field: "found" | "notes", value: string) {
    setFixedValues((prev) => ({ ...prev, [toolId]: { ...prev[toolId], [field]: value } }));
    const dbField = field === "found" ? "found_quantity" : "notes";
    const result = await updateDailyCheckField(toolId, date, dbField, value);
    setRowErrors((prev) => ({ ...prev, [toolId]: result?.error ?? "" }));
  }

  async function handleConsumableChange(
    toolId: string,
    field: "opening" | "used" | "damaged" | "notes",
    value: string
  ) {
    setConsumableValues((prev) => ({ ...prev, [toolId]: { ...prev[toolId], [field]: value } }));
    const dbField =
      field === "opening"
        ? "opening_balance"
        : field === "used"
          ? "used_quantity"
          : field === "damaged"
            ? "damaged_lost_quantity"
            : "notes";
    const result = await updateDailyCheckField(toolId, date, dbField, value);
    setRowErrors((prev) => ({ ...prev, [toolId]: result?.error ?? "" }));
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

  const q = search.trim().toLowerCase();
  const filteredFixed = q ? fixedTools.filter((t) => t.name.toLowerCase().includes(q)) : fixedTools;
  const filteredConsumable = q ? consumableTools.filter((t) => t.name.toLowerCase().includes(q)) : consumableTools;

  const total = tools.length;
  let enteredCount = 0;
  let fixedOkCount = 0;
  let problemCount = 0;
  let usedTotal = 0;
  for (const tool of fixedTools) {
    const v = fixedShown[tool.id];
    if (v?.found) {
      enteredCount++;
      const total2 = tool.total_quantity !== null ? parseFloat(tool.total_quantity) : NaN;
      const found = parseFloat(v.found);
      if (!isNaN(total2) && !isNaN(found)) {
        if (found === total2) fixedOkCount++;
        else if (found < total2) problemCount++;
      }
    }
  }
  for (const tool of consumableTools) {
    const v = consumableShown[tool.id];
    if (v && (v.used || v.damaged)) enteredCount++;
    const damaged = v ? parseFloat(v.damaged) : NaN;
    if (!isNaN(damaged) && damaged > 0) problemCount++;
    const used = v ? parseFloat(v.used) : NaN;
    if (!isNaN(used)) usedTotal += used;
  }
  const percent = total ? Math.round((enteredCount / total) * 100) : 0;

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
                  <div className="mt-0.5 text-[11px] text-white/65">{enteredCount} من {total} مادة مُدخَلة</div>
                </div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div className="font-display text-[22px] font-extrabold text-[var(--inv-ok)]">{fixedOkCount}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">أدوات بحالة جيدة</div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div
                  className="font-display text-[22px] font-extrabold"
                  style={{ color: problemCount > 0 ? "var(--inv-bad)" : "var(--inv-ok)" }}
                >
                  {problemCount}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">نواقص / تالف</div>
              </div>
              <div className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white p-3.5 shadow-sm">
                <div className="font-display text-[22px] font-extrabold text-[var(--inv-emerald-900)]">{usedTotal}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--muted,#6c7a70)]">إجمالي المستهلك اليوم</div>
              </div>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مادة…"
              className="w-full rounded-[11px] border border-[var(--inv-line,#e4e0d2)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink,#1c2b23)] outline-none focus:border-[var(--inv-emerald-700)]"
            />

            {loadingHistorical ? (
              <p className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white py-10 text-center text-[13px] text-[var(--muted,#6c7a70)]">
                جارٍ التحميل...
              </p>
            ) : (
              <>
                {filteredFixed.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-display text-[13px] font-extrabold text-[var(--inv-emerald-900)]">
                      الأدوات الثابتة
                    </h4>
                    <div className="overflow-hidden overflow-x-auto rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--inv-emerald-900)] text-white">
                            <th className="w-9 px-2.5 py-3 font-display text-[12px] font-bold">م</th>
                            <th className="px-2.5 py-3 text-start font-display text-[12px] font-bold">الاسم</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">الرصيد السابق</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">الموجود فعليًا</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">الحالة</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFixed.map((tool, index) => (
                            <InventoryFixedRow
                              key={tool.id}
                              index={index}
                              tool={tool}
                              value={fixedShown[tool.id] ?? { found: "", notes: "" }}
                              editable={editable}
                              onChange={(field, value) => handleFixedChange(tool.id, field, value)}
                              error={rowErrors[tool.id]}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {filteredConsumable.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-display text-[13px] font-extrabold text-[var(--inv-emerald-900)]">
                      المواد المستهلكة
                    </h4>
                    <div className="overflow-hidden overflow-x-auto rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--inv-emerald-900)] text-white">
                            <th className="w-9 px-2.5 py-3 font-display text-[12px] font-bold">م</th>
                            <th className="px-2.5 py-3 text-start font-display text-[12px] font-bold">الاسم</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">رصيد بداية اليوم</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">المستخدم</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">تالف/مفقود</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">المتبقي</th>
                            <th className="px-2.5 py-3 font-display text-[12px] font-bold">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredConsumable.map((tool, index) => (
                            <InventoryConsumableRow
                              key={tool.id}
                              index={index}
                              tool={tool}
                              value={consumableShown[tool.id] ?? { opening: "", used: "", damaged: "", notes: "" }}
                              editable={editable}
                              onChange={(field, value) => handleConsumableChange(tool.id, field, value)}
                              error={rowErrors[tool.id]}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {filteredFixed.length === 0 && filteredConsumable.length === 0 && (
                  <p className="rounded-[14px] border border-[var(--inv-line,#e4e0d2)] bg-white py-10 text-center text-[13px] text-[var(--muted,#6c7a70)]">
                    {tools.length === 0 ? "لا توجد مواد في هذا المسار بعد" : "لا نتائج مطابقة للبحث"}
                  </p>
                )}
              </>
            )}

            <p className="flex items-center gap-2 rounded-[10px] border border-dashed border-[var(--inv-line,#e4e0d2)] bg-white px-3.5 py-2.5 text-[12px] text-[var(--muted,#6c7a70)]">
              💡 الأدوات الثابتة: أدخل الموجود فعليًا فقط. المواد المستهلكة: أدخل المستخدم والتالف/المفقود، ويُحسب المتبقي تلقائيًا ويصبح رصيد بداية الغد.
            </p>
          </>
        ) : (
          <InventoryToolsManager trackId={track.id} tools={tools} />
        )}
      </div>
    </div>
  );
}
