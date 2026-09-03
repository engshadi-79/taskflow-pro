"use client";

import { useRef, useState } from "react";
import { parseTemplateAndDataFiles, type ParseTemplateResult } from "@/lib/actions/template-converter";
import {
  saveTemplate,
  listSavedTemplates,
  deleteSavedTemplate,
  type SavedTemplateRow,
} from "@/lib/actions/saved-templates";
import { PageHeader } from "@/components/shared/page-header";
import { ChartIcon, DownloadIcon } from "@/components/shared/icons";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type OutputFormat = "xlsx" | "docx";
type TemplateMode = "upload" | "saved";

// Must match computeGroupKey's separator in template-file-utils.ts exactly -
// duplicated here (rather than imported) so this client component doesn't
// pull ExcelJS/JSZip into the browser bundle.
const GROUP_KEY_SEPARATOR = " ||| ";
function computeGroupKey(columns: string[], row: Record<string, string | number | null>): string {
  // Trimmed - must match the server's own computeGroupKey exactly (same
  // fix, same reasoning: an untrimmed source value would split one real
  // group into several), or a per-group weekday selection made here
  // wouldn't line up with the group the server actually produces.
  return columns.map((c) => String(row[c] ?? "").trim()).join(GROUP_KEY_SEPARATOR);
}

// Mirrors the route's own contentDisposition() helper - prefers the RFC 5987
// filename*=UTF-8''<percent-encoded> form (the real Arabic name) and only
// falls back to the plain ASCII filename="..." if that's missing.
function extractDownloadFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // fall through to the ASCII form below
    }
  }
  const asciiMatch = header.match(/filename="([^"]+)"/i);
  return asciiMatch ? asciiMatch[1] : null;
}

const WEEKDAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// Display order only (Saturday first) - the values themselves stay the real
// Date#getDay() numbers (0=Sunday..6=Saturday) that computeSessionDates
// expects; only the order checkboxes are laid out in changes.
const WEEKDAY_DISPLAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function TemplateConverter({ initialSavedTemplates }: { initialSavedTemplates: SavedTemplateRow[] }) {
  const templateInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<TemplateMode>(initialSavedTemplates.length > 0 ? "saved" : "upload");
  // Tracks the uploaded template's extension for templateIsDocx below -
  // reading templateInputRef.current directly during render is not allowed
  // (react-hooks/refs), so the file input's own onChange keeps this in sync
  // instead.
  const [uploadedTemplateIsDocx, setUploadedTemplateIsDocx] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState(initialSavedTemplates);
  const [selectedSavedId, setSelectedSavedId] = useState(initialSavedTemplates[0]?.id ?? "");

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseTemplateResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("xlsx");
  const [groupByHeader, setGroupByHeader] = useState("");
  const [groupByHeader2, setGroupByHeader2] = useState("");
  const [autoNumberHeader, setAutoNumberHeader] = useState("");
  const [sortRowsBy, setSortRowsBy] = useState("");
  const [fitGroupToOnePage, setFitGroupToOnePage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datesEnabled, setDatesEnabled] = useState(false);
  const [datesStartDate, setDatesStartDate] = useState("");
  const [datesEndDate, setDatesEndDate] = useState("");
  const [datesWeekdays, setDatesWeekdays] = useState<number[]>([]);
  const [groupWeekdays, setGroupWeekdays] = useState<Record<string, number[]>>({});

  // The <select> below has no empty placeholder option, so if selectedSavedId
  // ever drifts from the current savedTemplates list (e.g. right after the
  // very first save, before its id was recorded), the browser still shows
  // the first <option> as chosen while the real state has nothing selected -
  // deriving the effective id from the actual list closes that gap for good
  // instead of only patching each place savedTemplates changes.
  const effectiveSavedId =
    selectedSavedId && savedTemplates.some((t) => t.id === selectedSavedId)
      ? selectedSavedId
      : savedTemplates[0]?.id ?? "";
  const selectedSavedTemplate = savedTemplates.find((t) => t.id === effectiveSavedId);

  async function handleParse() {
    const dataFile = dataInputRef.current?.files?.[0];
    if (!dataFile) {
      setError("اختر ملف البيانات");
      return;
    }

    const formData = new FormData();
    if (mode === "upload") {
      const templateFile = templateInputRef.current?.files?.[0];
      if (!templateFile) {
        setError("اختر ملف القالب");
        return;
      }
      formData.append("templateFile", templateFile);
    } else {
      if (!effectiveSavedId) {
        setError("اختر قالبًا محفوظًا");
        return;
      }
      formData.append("savedTemplateId", effectiveSavedId);
    }
    formData.append("dataFile", dataFile);

    setParsing(true);
    setError(null);
    setParsed(null);

    const result = await parseTemplateAndDataFiles(formData);
    setParsing(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setParsed(result);
    setMapping(result.suggestedMapping);
    setGroupByHeader("");
    setGroupByHeader2("");
    setAutoNumberHeader("");
    setGroupWeekdays({});
    setDatesWeekdays([]);
  }

  async function handleSaveTemplate() {
    const templateFile = templateInputRef.current?.files?.[0];
    if (!templateFile) {
      setSaveError("اختر ملف القالب أولًا");
      return;
    }
    if (!saveName.trim()) {
      setSaveError("اسم القالب مطلوب");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const formData = new FormData();
    formData.append("templateFile", templateFile);
    formData.append("name", saveName.trim());

    const result = await saveTemplate(formData);
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    setShowSaveForm(false);
    setSaveName("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    const refreshed = await listSavedTemplates();
    setSavedTemplates(refreshed);
    // The <select> below has no empty option, so leaving selectedSavedId at
    // its old value (often "" the very first time) makes the browser fall
    // back to displaying the first <option> as if chosen while the actual
    // state stays empty - "اختر قالبًا محفوظًا" then fires on generate even
    // though a template visibly appears selected. Point it at the template
    // that was just saved (always first, listed newest-first) explicitly.
    if (result.id) setSelectedSavedId(result.id);
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("حذف هذا القالب المحفوظ؟")) return;
    await deleteSavedTemplate(id);
    setSavedTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (selectedSavedId === id) setSelectedSavedId(next[0]?.id ?? "");
      return next;
    });
  }

  // Both Word and Excel can group by a combination of columns (e.g. track +
  // group together), so a section is one specific track/group pair rather
  // than mixing rows that only share one of the two.
  const activeGroupColumns = [groupByHeader, groupByHeader2].filter(Boolean);

  async function handleGenerate() {
    if (!parsed || "error" in parsed) return;

    setGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      // Resent so the server can fill the real template file in place
      // (keeping its letterhead/logo/styling) instead of building a bare
      // document - see the route's own comment for when that applies.
      if (mode === "upload") {
        const templateFile = templateInputRef.current?.files?.[0];
        if (templateFile) formData.append("templateFile", templateFile);
      } else if (effectiveSavedId) {
        formData.append("savedTemplateId", effectiveSavedId);
      }
      formData.append("templateHeaders", JSON.stringify(parsed.templateHeaders));
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("dataRows", JSON.stringify(parsed.dataRows));
      formData.append("outputFormat", outputFormat);
      if (activeGroupColumns.length > 0) {
        formData.append("groupByColumns", JSON.stringify(activeGroupColumns));
      }
      if (autoNumberHeader) {
        formData.append("autoNumberHeader", autoNumberHeader);
      }
      if (sortRowsBy && outputFormat === "xlsx") {
        formData.append("sortRowsBy", sortRowsBy);
      }
      if (fitGroupToOnePage && outputFormat === "docx" && activeGroupColumns.length > 0) {
        formData.append("fitGroupToOnePage", "1");
      }
      if (datesEnabled && outputFormat === "xlsx" && datesStartDate && datesEndDate) {
        formData.append("sessionDatesStartDate", datesStartDate);
        formData.append("sessionDatesEndDate", datesEndDate);
        if (activeGroupColumns.length > 0) {
          formData.append("sessionDatesWeekdaysByGroup", JSON.stringify(groupWeekdays));
        } else if (datesWeekdays.length > 0) {
          formData.append("sessionDatesWeekdays", JSON.stringify(datesWeekdays));
        }
      }

      const response = await fetch("/api/reports/convert-template", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || "تعذر توليد الملف");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // response.blob() drops every response header, so the server's own
      // Content-Disposition (template name + month, see the route's
      // outputName logic) never reaches the browser's save dialog unless
      // it's read back out here explicitly - a bare a.download fallback
      // would silently save every file as "converted.xlsx" regardless of
      // what the server actually named it.
      a.download = extractDownloadFilename(response.headers.get("Content-Disposition")) ?? `converted.${outputFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  const result = parsed && !("error" in parsed) ? parsed : null;
  const templateIsDocx = mode === "upload" ? uploadedTemplateIsDocx : selectedSavedTemplate?.file_format === "docx";
  const sameFormat = (outputFormat === "docx") === templateIsDocx;

  // Distinct real combinations found in the uploaded data for whichever
  // grouping column(s) are selected, so the "days per group" list is built
  // from the actual values in this file rather than typed in by hand.
  const distinctGroups: { key: string; label: string }[] = [];
  if (result && activeGroupColumns.length > 0) {
    const seen = new Map<string, string>();
    for (const row of result.dataRows) {
      const key = computeGroupKey(activeGroupColumns, row);
      if (!seen.has(key)) seen.set(key, activeGroupColumns.map((c) => String(row[c] ?? "")).join(" - "));
    }
    distinctGroups.push(...Array.from(seen.entries()).map(([key, label]) => ({ key, label })));
  }

  function toggleWeekday(day: number) {
    setDatesWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function toggleGroupWeekday(key: string, day: number) {
    setGroupWeekdays((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
      return { ...prev, [key]: next };
    });
  }

  return (
    <div className="max-w-3xl space-y-4.5">
      <PageHeader
        title="تحويل ملف حسب قالب"
        subtitle="اختر قالبًا (Excel أو Word) يحدّد شكل المخرجات، وملف بيانات Excel، ثم اربط الأعمدة واحصل على ملف واحد مُطابق للقالب"
        variant="teal"
        icon={<ChartIcon className="h-6 w-6" />}
      />

      <div className="rounded-[16px] border border-border bg-surface p-5">
        <div className="mb-3.5 flex items-center gap-1.5 rounded-[10px] bg-background p-1">
          <button
            type="button"
            onClick={() => setMode("saved")}
            className={`flex-1 rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
              mode === "saved" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
            }`}
          >
            من القوالب المحفوظة
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
              mode === "upload" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
            }`}
          >
            رفع قالب جديد
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {mode === "saved" ? (
            <div>
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">القالب المحفوظ</span>
              {savedTemplates.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-[12.5px] text-muted">
                  لا توجد قوالب محفوظة بعد — ارفع قالبًا جديدًا واحفظه لاستخدامه هنا لاحقًا.
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={effectiveSavedId}
                    onChange={(e) => setSelectedSavedId(e.target.value)}
                    className={inputClass}
                  >
                    {savedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.file_format === "docx" ? "Word" : "Excel"})
                      </option>
                    ))}
                  </select>
                  {effectiveSavedId && (
                    <>
                      <a
                        href={`/api/reports/saved-templates/${effectiveSavedId}/download`}
                        className="shrink-0 text-[11.5px] font-bold text-accent-600 hover:underline"
                      >
                        تحميل
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(effectiveSavedId)}
                        className="shrink-0 text-[11.5px] font-bold text-red-500 hover:underline"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
                ملف القالب — Excel أو Word (يحدّد شكل الأعمدة النهائية)
              </span>
              <input
                ref={templateInputRef}
                type="file"
                accept=".xlsx,.docx"
                className={inputClass}
                onChange={(e) => setUploadedTemplateIsDocx(e.target.files?.[0]?.name.toLowerCase().endsWith(".docx") ?? false)}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">ملف البيانات المصدر (Excel)</span>
            <input ref={dataInputRef} type="file" accept=".xlsx" className={inputClass} />
          </label>
        </div>

        {mode === "upload" && (
          <div className="mt-3">
            {showSaveForm ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-accent-200 bg-accent-50 p-3">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="اسم القالب"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="rounded-[8px] bg-accent-600 px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveForm(false);
                    setSaveError(null);
                  }}
                  className="text-[12.5px] font-bold text-muted hover:underline"
                >
                  إلغاء
                </button>
                {saveError && <p className="w-full text-[12px] font-bold text-red-600">{saveError}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                className="text-[12.5px] font-bold text-accent-600 hover:underline"
              >
                حفظ هذا القالب لاستخدامه لاحقًا
              </button>
            )}
            {saved && <p className="mt-1.5 text-[11.5px] font-bold text-green-600">تم حفظ القالب</p>}
          </div>
        )}

        <button
          type="button"
          onClick={handleParse}
          disabled={parsing}
          className="mt-4 rounded-[10px] bg-accent-500 px-4 py-2 text-[13px] font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {parsing ? "جارٍ التحليل..." : "تحليل الملفين"}
        </button>

        {error && (
          <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2.5 text-[13px] font-bold text-red-700">{error}</p>
        )}
      </div>

      {result && (
        <div className="rounded-[16px] border border-border bg-surface p-5">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-faint">
            اربط كل عمود في القالب بالعمود المقابل له في ملف البيانات
          </p>

          <div className="space-y-2">
            {result.templateHeaders.map((header) => (
              <div key={header} className="flex flex-wrap items-center gap-2">
                <span className="w-40 shrink-0 text-[13px] font-bold text-foreground">{header}</span>
                <select
                  value={mapping[header] ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                  className={`${inputClass} w-auto flex-1`}
                >
                  <option value="">— بدون —</option>
                  {result.dataHeaders.map((dh) => (
                    <option key={dh} value={dh}>
                      {dh}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-faint">
            {result.dataRows.length} صف من ملف البيانات{result.truncated ? " (تم الاقتصار على أول 5000 صف)" : ""}
          </p>

          <div className="mt-4 flex items-center gap-1.5 rounded-[10px] bg-background p-1">
            <button
              type="button"
              onClick={() => setOutputFormat("xlsx")}
              className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
                outputFormat === "xlsx" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
              }`}
            >
              مخرج Excel
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat("docx")}
              className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${
                outputFormat === "docx" ? "bg-surface text-accent-700 shadow-sm" : "text-muted"
              }`}
            >
              مخرج Word
            </button>
          </div>

          <p className="mt-2 text-[11px] text-faint">
            {sameFormat
              ? "المخرج بنفس صيغة القالب، فسيحافظ على تنسيقه وترويسته كما هي."
              : "المخرج بصيغة مختلفة عن القالب، فسيُنشأ ملف جديد بجدول بسيط بدون تنسيق القالب الأصلي."}
          </p>

          {sameFormat && (
            <div className="mt-3">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
                تجميع الصفوف وتكرار العنوان عند كل مجموعة (اختياري)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={groupByHeader}
                  onChange={(e) => {
                    setGroupByHeader(e.target.value);
                    setGroupWeekdays({});
                  }}
                  className={`${inputClass} w-auto`}
                >
                  <option value="">بدون تجميع</option>
                  {result.dataHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
                {groupByHeader && (
                  <select
                    value={groupByHeader2}
                    onChange={(e) => {
                      setGroupByHeader2(e.target.value);
                      setGroupWeekdays({});
                    }}
                    className={`${inputClass} w-auto`}
                  >
                    <option value="">+ مستوى تجميع ثانٍ (اختياري، مثلًا المجموعة)</option>
                    {result.dataHeaders
                      .filter((h) => h !== groupByHeader)
                      .map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              {groupByHeader && !groupByHeader2 && (
                <p className="mt-1.5 rounded-[8px] bg-amber-50 px-2.5 py-2 text-[11.5px] font-bold text-amber-800">
                  ⚠ اخترت مستوى تجميع واحد فقط ({groupByHeader}). لو كانت الصفوف التي تشترك في نفس القيمة تنتمي لأعمدة
                  أخرى مختلفة (مثل مسارات مختلفة)، سيتم دمجها كلها في قسم واحد بغض النظر عن ذلك العمود الآخر، وسيظهر
                  عنوان القسم بقيمة أول صف فقط لا كل الصفوف. أضف المستوى الثاني بالأسفل لو أردت فصلها أيضًا.
                </p>
              )}
              <p className="mt-1 text-[11px] text-faint">
                اختر عمود المجموعة من ملف البيانات نفسه (وليس من أعمدة القالب) - يفيد هذا حتى لو كانت المجموعة تظهر
                بالقالب فقط داخل عنوان مثل {"{{المجموعة}}"} وليست عمودًا مستقلًا في الجدول. أضف مستوى ثانٍ لو أردت
                تقسيمًا مركّبًا (مثلًا مسار + مجموعة معًا)، فيظهر كل مسار ومجموعة كقسم مستقل. يرتّب الصفوف بحيث تكون
                كل مجموعة معًا، ويكرر ترويسة القالب مع فاصل صفحة حقيقي عند بداية كل مجموعة جديدة.
                {outputFormat === "docx"
                  ? " أي محتوى بعد الجدول في القالب (مثل توقيع أو اعتماد) يتكرر أيضًا مع كل مجموعة."
                  : ""}
              </p>
            </div>
          )}

          {sameFormat && outputFormat === "docx" && activeGroupColumns.length > 0 && (
            <div className="mt-3 rounded-[10px] border border-border p-3">
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={fitGroupToOnePage}
                  onChange={(e) => setFitGroupToOnePage(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                تقليص ارتفاع الصفوف وحجم الخط تلقائيًا لتقريب كل مجموعة من صفحة واحدة
              </label>
              <p className="mt-1 text-[11px] text-faint">
                يقلّص حجم الخط وارتفاع صف الترويسة حسب عدد صفوف كل مجموعة - كلما زاد عدد الطلاب، زاد التقليص (بحد أدنى
                لا يقل عن حجم مقروء). هذا تقدير وليس ضمانًا مؤكدًا لصفحة واحدة في كل الحالات، خصوصًا للمجموعات الكبيرة
                جدًا.
              </p>
            </div>
          )}

          {sameFormat && outputFormat === "xlsx" && (
            <div className="mt-3 rounded-[10px] border border-border p-3">
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={datesEnabled}
                  onChange={(e) => setDatesEnabled(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                توليد تواريخ الحضور تلقائيًا (اختياري)
              </label>
              {datesEnabled && (
                <div className="mt-2.5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
                      من تاريخ
                      <input
                        type="date"
                        value={datesStartDate}
                        onChange={(e) => setDatesStartDate(e.target.value)}
                        className={`${inputClass} w-auto`}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
                      إلى تاريخ
                      <input
                        type="date"
                        value={datesEndDate}
                        onChange={(e) => setDatesEndDate(e.target.value)}
                        className={`${inputClass} w-auto`}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-faint">
                    يمكن تحديد أي مدى تريده (مثلًا نصف الشهر الأول 01/08 إلى 15/08) لا الشهر كاملًا بالضرورة - يحسب أول
                    7 تواريخ داخل هذا المدى توافق الأيام المحددة لكل مجموعة، ويستبدل بها صف التواريخ الموجود في القالب
                    في القسم الخاص بتلك المجموعة.
                  </p>
                  {distinctGroups.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-foreground">
                        حدد أيام الأسبوع الخاصة بكل مجموعة موجودة فعليًا في ملف البيانات:
                      </p>
                      {distinctGroups.map(({ key, label }) => (
                        <div key={key} className="rounded-[8px] border border-border p-2">
                          <p className="mb-1 text-[12px] font-extrabold text-foreground">{label}</p>
                          <div className="flex flex-wrap gap-2.5">
                            {WEEKDAY_DISPLAY_ORDER.map((day) => (
                              <label key={day} className="flex items-center gap-1 text-[11.5px] font-bold text-foreground">
                                <input
                                  type="checkbox"
                                  checked={(groupWeekdays[key] ?? []).includes(day)}
                                  onChange={() => toggleGroupWeekday(key, day)}
                                  className="h-3.5 w-3.5"
                                />
                                {WEEKDAY_NAMES[day]}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {WEEKDAY_DISPLAY_ORDER.map((day) => (
                        <label key={day} className="flex items-center gap-1 text-[12px] font-bold text-foreground">
                          <input
                            type="checkbox"
                            checked={datesWeekdays.includes(day)}
                            onChange={() => toggleWeekday(day)}
                            className="h-3.5 w-3.5"
                          />
                          {WEEKDAY_NAMES[day]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {sameFormat && (
            <div className="mt-3">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
                ترقيم تلقائي لعمود (اختياري)
              </span>
              <select
                value={autoNumberHeader}
                onChange={(e) => setAutoNumberHeader(e.target.value)}
                className={`${inputClass} w-auto`}
              >
                <option value="">بدون ترقيم تلقائي</option>
                {result.templateHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-faint">
                يملأ هذا العمود بأرقام تسلسلية (1، 2، 3...) بدل قيمة من ملف البيانات
                {groupByHeader ? "، وتبدأ الترقيم من 1 من جديد مع كل مجموعة." : "."}
              </p>
            </div>
          )}

          {sameFormat && outputFormat === "xlsx" && (
            <div className="mt-3">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
                ترتيب الصفوف أبجديًا حسب عمود (اختياري)
              </span>
              <select
                value={sortRowsBy}
                onChange={(e) => setSortRowsBy(e.target.value)}
                className={`${inputClass} w-auto`}
              >
                <option value="">بدون ترتيب (نفس ترتيب ملف البيانات)</option>
                {result.dataHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-faint">
                يرتّب الصفوف أبجديًا حسب هذا العمود من ملف البيانات (مثل اسم الطالب)
                {groupByHeader ? "، كل مجموعة تُرتَّب بمفردها." : "."}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 flex items-center gap-1.5 rounded-[10px] bg-accent-600 px-4 py-2 text-[13px] font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
            {generating ? "جارٍ التوليد..." : "توليد الملف وتنزيله"}
          </button>
        </div>
      )}
    </div>
  );
}
