"use client";

import { useState, useTransition } from "react";
import {
  runReport,
  saveReportDefinition,
  listReportDefinitions,
  deleteReportDefinition,
  type RunReportResult,
  type SavedReportRow,
  type AggregateFn,
  type ChartType,
} from "@/lib/actions/report-builder";
import {
  REPORT_SOURCES,
  SOURCE_KEYS,
  getReportableFields,
  getField,
  OPERATORS_BY_TYPE,
  type SourceKey,
  type ReportFilter,
} from "@/lib/reports/report-fields-registry";
import { PageHeader } from "@/components/shared/page-header";
import { ChartIcon, CheckSquareIcon, PlusIcon, CloseIcon, DownloadIcon } from "@/components/shared/icons";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

const BAR_COLORS = ["bg-accent-500", "bg-teal-500", "bg-orange-500", "bg-pink-500", "bg-purple-500", "bg-green-500"];

function defaultFieldsFor(source: SourceKey): string[] {
  return getReportableFields(source)
    .slice(0, 4)
    .map((f) => f.key);
}

export function ReportBuilder({ initialSavedReports }: { initialSavedReports: SavedReportRow[] }) {
  const [source, setSource] = useState<SourceKey>("tasks");
  const [selectedFields, setSelectedFields] = useState<string[]>(() => defaultFieldsFor("tasks"));
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [aggregateField, setAggregateField] = useState("");
  const [aggregateFn, setAggregateFn] = useState<AggregateFn>("sum");
  const [chartType, setChartType] = useState<ChartType>("table");

  const [result, setResult] = useState<RunReportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [reportName, setReportName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [savedReports, setSavedReports] = useState(initialSavedReports);

  const allFields = getReportableFields(source);
  const groupableFields = allFields.filter((f) => f.groupable);
  const aggregatableFields = allFields.filter((f) => f.aggregatable);

  function switchSource(next: SourceKey) {
    setSource(next);
    setSelectedFields(defaultFieldsFor(next));
    setFilters([]);
    setGroupBy("");
    setAggregateField("");
    setResult(null);
  }

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function addFilter() {
    const first = allFields.find((f) => f.filterable);
    if (!first) return;
    setFilters((prev) => [...prev, { field: first.key, op: OPERATORS_BY_TYPE[first.type][0].value, value: "" }]);
  }

  function updateFilter(index: number, patch: Partial<ReportFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function run() {
    startTransition(async () => {
      const res = await runReport({
        source,
        fields: selectedFields,
        filters,
        groupBy: groupBy || undefined,
        aggregate: groupBy && aggregateField ? { field: aggregateField, fn: aggregateFn } : undefined,
      });
      setResult(res);
    });
  }

  async function handleSave() {
    if (!reportName.trim()) {
      setSaveError("اسم التقرير مطلوب");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await saveReportDefinition({
      name: reportName.trim(),
      source,
      fields: selectedFields,
      filters,
      groupBy: groupBy || undefined,
      aggregate: groupBy && aggregateField ? { field: aggregateField, fn: aggregateFn } : undefined,
      chartType,
    });
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setShowSave(false);
    setReportName("");
    setSavedReports(await listReportDefinitions());
  }

  function loadSaved(report: SavedReportRow) {
    setSource(report.source_entity);
    setSelectedFields(report.selected_fields);
    setFilters(report.filters);
    setGroupBy(report.group_by ?? "");
    setAggregateField(report.aggregate?.field ?? "");
    setAggregateFn(report.aggregate?.fn ?? "sum");
    setChartType(report.chart_type);
    setResult(null);
  }

  async function removeSaved(id: string) {
    if (!confirm("حذف هذا التقرير المحفوظ؟")) return;
    await deleteReportDefinition(id);
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
  }

  function exportCsv() {
    if (!result || "error" in result || result.rows.length === 0) return;
    const header = result.fields.map((f) => f.label).join(",");
    const body = result.rows
      .map((row) => result.fields.map((f) => `"${String(row[f.key] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${REPORT_SOURCES[source].label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const resultRows = result && !("error" in result) ? result.rows : [];
  const resultFields = result && !("error" in result) ? result.fields : [];
  const grouped = result && !("error" in result) ? result.grouped : undefined;
  const maxGroupValue = grouped?.length ? Math.max(...grouped.map((g) => g.aggregate ?? g.count)) : 0;

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="منشئ التقارير"
        subtitle="اختر مصدر البيانات والحقول لإنشاء أي تقرير مخصّص من بيانات النظام"
        variant="teal"
        icon={<ChartIcon className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-[16px] border border-border bg-surface p-4">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">مصدر البيانات</p>
            <div className="space-y-1">
              {SOURCE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchSource(key)}
                  className={`block w-full rounded-[10px] px-3 py-2 text-start text-[13px] font-bold transition-colors ${
                    key === source ? "bg-accent-50 text-accent-700" : "text-muted hover:bg-background"
                  }`}
                >
                  {REPORT_SOURCES[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-border bg-surface p-4">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">الحقول المعروضة</p>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {allFields.map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] font-medium text-foreground hover:bg-background"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="h-4 w-4 accent-accent-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-border bg-surface p-4">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">التجميع حسب</p>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                setAggregateField("");
              }}
              className={inputClass}
            >
              <option value="">بدون تجميع</option>
              {groupableFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            {groupBy && aggregatableFields.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                <select
                  value={aggregateField}
                  onChange={(e) => setAggregateField(e.target.value)}
                  className={inputClass}
                >
                  <option value="">عدد السجلات فقط</option>
                  {aggregatableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {aggregateField && (
                  <select
                    value={aggregateFn}
                    onChange={(e) => setAggregateFn(e.target.value as AggregateFn)}
                    className={`${inputClass} w-24 shrink-0`}
                  >
                    <option value="sum">مجموع</option>
                    <option value="avg">متوسط</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {savedReports.length > 0 && (
            <div className="rounded-[16px] border border-border bg-surface p-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">التقارير المحفوظة</p>
              <div className="space-y-1">
                {savedReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] hover:bg-background"
                  >
                    <button
                      type="button"
                      onClick={() => loadSaved(r)}
                      className="flex-1 text-start font-bold text-foreground hover:text-accent-600"
                    >
                      {r.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(r.id)}
                      className="text-[11px] font-bold text-red-500 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="space-y-4">
          <div className="rounded-[16px] border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">عوامل التصفية</p>
              <button
                type="button"
                onClick={addFilter}
                className="flex items-center gap-1 text-[12.5px] font-bold text-accent-600 hover:underline"
              >
                <PlusIcon className="h-3.5 w-3.5" /> إضافة شرط
              </button>
            </div>

            {filters.length === 0 && (
              <p className="text-[12.5px] text-muted">لا توجد عوامل تصفية — سيتم عرض كل البيانات.</p>
            )}

            <div className="space-y-2">
              {filters.map((f, i) => {
                const field = getField(source, f.field);
                const ops = field ? OPERATORS_BY_TYPE[field.type] : [];
                return (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={f.field}
                      onChange={(e) => {
                        const nextField = getField(source, e.target.value)!;
                        updateFilter(i, { field: e.target.value, op: OPERATORS_BY_TYPE[nextField.type][0].value });
                      }}
                      className={`${inputClass} w-auto`}
                    >
                      {allFields.filter((fl) => fl.filterable).map((fl) => (
                        <option key={fl.key} value={fl.key}>
                          {fl.label}
                        </option>
                      ))}
                    </select>
                    <select value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as ReportFilter["op"] })} className={`${inputClass} w-auto`}>
                      {ops.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={f.value}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                      placeholder="القيمة"
                      className={`${inputClass} w-32`}
                    />
                    <button type="button" onClick={() => removeFilter(i)} className="text-faint hover:text-red-600">
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[16px] border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 rounded-[10px] bg-background p-1">
                <button
                  type="button"
                  onClick={() => setChartType("table")}
                  className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
                    chartType === "table" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
                  }`}
                >
                  <CheckSquareIcon className="h-3.5 w-3.5" /> جدول
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("bar")}
                  className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
                    chartType === "bar" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
                  }`}
                >
                  <ChartIcon className="h-3.5 w-3.5" /> أعمدة
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={run}
                  disabled={pending || selectedFields.length === 0}
                  className="rounded-[10px] bg-accent-500 px-4 py-2 text-[13px] font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
                >
                  {pending ? "جارٍ التنفيذ..." : "تشغيل التقرير"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSave(true)}
                  disabled={selectedFields.length === 0}
                  className="rounded-[10px] border border-border px-3 py-2 text-[13px] font-bold text-foreground hover:bg-background disabled:opacity-60"
                >
                  حفظ التقرير
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={resultRows.length === 0}
                  className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[13px] font-bold text-foreground hover:bg-background disabled:opacity-60"
                >
                  <DownloadIcon className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>

            {showSave && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-accent-200 bg-accent-50 p-3">
                <input
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="اسم التقرير"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-[8px] bg-accent-600 px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSave(false);
                    setSaveError(null);
                  }}
                  className="text-[12.5px] font-bold text-muted hover:underline"
                >
                  إلغاء
                </button>
                {saveError && <p className="w-full text-[12px] font-bold text-red-600">{saveError}</p>}
              </div>
            )}

            {result && "error" in result && (
              <p className="rounded-[10px] bg-red-50 px-3 py-2.5 text-[13px] font-bold text-red-700">{result.error}</p>
            )}

            {!result && !pending && (
              <p className="py-10 text-center text-[13px] text-muted">
                اضبط الحقول والفلاتر ثم اضغط «تشغيل التقرير» لعرض النتائج.
              </p>
            )}

            {result && !("error" in result) && chartType === "table" && (
              <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-background">
                    <tr>
                      {resultFields.map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-3 py-2 text-start font-extrabold text-foreground">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultRows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-background">
                        {resultFields.map((f) => (
                          <td key={f.key} className="whitespace-nowrap px-3 py-2 text-foreground">
                            {String(row[f.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resultRows.length === 0 && (
                  <p className="p-6 text-center text-[12.5px] text-muted">لا توجد نتائج مطابقة للشروط الحالية</p>
                )}
              </div>
            )}

            {result && !("error" in result) && chartType === "bar" && (
              <>
                {!grouped ? (
                  <p className="rounded-[10px] bg-orange-50 px-3 py-3 text-[12.5px] font-bold text-orange-700">
                    اختر حقل «التجميع حسب» من الشريط الجانبي لعرض رسم الأعمدة.
                  </p>
                ) : grouped.length === 0 ? (
                  <p className="p-6 text-center text-[12.5px] text-muted">لا توجد نتائج مطابقة للشروط الحالية</p>
                ) : (
                  <div className="flex h-64 items-end gap-3 overflow-x-auto px-1 pb-1">
                    {grouped.map((g, i) => {
                      const value = g.aggregate ?? g.count;
                      const heightPct = maxGroupValue > 0 ? Math.max(4, (value / maxGroupValue) * 100) : 4;
                      return (
                        <div key={g.name} className="flex h-full min-w-[64px] flex-1 flex-col items-center justify-end gap-1.5">
                          <span className="text-[11.5px] font-extrabold text-foreground">{value}</span>
                          <div
                            className={`w-full rounded-t-[6px] ${BAR_COLORS[i % BAR_COLORS.length]}`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="line-clamp-2 text-center text-[10.5px] font-bold text-muted">{g.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {result && !("error" in result) && (
              <p className="mt-2 text-[11px] text-faint">
                {result.rowCount} سجل{result.truncated ? " (تم اقتصار العرض على أول 2000 سجل مطابق)" : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
