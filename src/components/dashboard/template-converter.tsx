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

export function TemplateConverter({ initialSavedTemplates }: { initialSavedTemplates: SavedTemplateRow[] }) {
  const templateInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<TemplateMode>(initialSavedTemplates.length > 0 ? "saved" : "upload");
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSavedTemplate = savedTemplates.find((t) => t.id === selectedSavedId);

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
      if (!selectedSavedId) {
        setError("اختر قالبًا محفوظًا");
        return;
      }
      formData.append("savedTemplateId", selectedSavedId);
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
    setSavedTemplates(await listSavedTemplates());
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("حذف هذا القالب المحفوظ؟")) return;
    await deleteSavedTemplate(id);
    setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedSavedId === id) setSelectedSavedId("");
  }

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
      } else if (selectedSavedId) {
        formData.append("savedTemplateId", selectedSavedId);
      }
      formData.append("templateHeaders", JSON.stringify(parsed.templateHeaders));
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("dataRows", JSON.stringify(parsed.dataRows));
      formData.append("outputFormat", outputFormat);

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
      a.download = `converted.${outputFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  const result = parsed && !("error" in parsed) ? parsed : null;
  const templateIsDocx = mode === "upload" ? templateInputRef.current?.files?.[0]?.name.toLowerCase().endsWith(".docx") ?? false : selectedSavedTemplate?.file_format === "docx";

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
                    value={selectedSavedId}
                    onChange={(e) => setSelectedSavedId(e.target.value)}
                    className={inputClass}
                  >
                    {savedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.file_format === "docx" ? "Word" : "Excel"})
                      </option>
                    ))}
                  </select>
                  {selectedSavedId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(selectedSavedId)}
                      className="shrink-0 text-[11.5px] font-bold text-red-500 hover:underline"
                    >
                      حذف
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
                ملف القالب — Excel أو Word (يحدّد شكل الأعمدة النهائية)
              </span>
              <input ref={templateInputRef} type="file" accept=".xlsx,.docx" className={inputClass} />
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
            {(outputFormat === "docx") === templateIsDocx
              ? "المخرج بنفس صيغة القالب، فسيحافظ على تنسيقه وترويسته كما هي."
              : "المخرج بصيغة مختلفة عن القالب، فسيُنشأ ملف جديد بجدول بسيط بدون تنسيق القالب الأصلي."}
          </p>

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
