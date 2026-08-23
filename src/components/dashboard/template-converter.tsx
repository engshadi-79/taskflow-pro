"use client";

import { useRef, useState } from "react";
import { parseTemplateAndDataFiles, type ParseTemplateResult } from "@/lib/actions/template-converter";
import { PageHeader } from "@/components/shared/page-header";
import { ChartIcon, DownloadIcon } from "@/components/shared/icons";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type OutputFormat = "xlsx" | "docx";

export function TemplateConverter() {
  const templateInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseTemplateResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("xlsx");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    const templateFile = templateInputRef.current?.files?.[0];
    const dataFile = dataInputRef.current?.files?.[0];
    if (!templateFile || !dataFile) {
      setError("اختر ملف القالب وملف البيانات معًا");
      return;
    }

    setParsing(true);
    setError(null);
    setParsed(null);

    const formData = new FormData();
    formData.append("templateFile", templateFile);
    formData.append("dataFile", dataFile);

    const result = await parseTemplateAndDataFiles(formData);
    setParsing(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setParsed(result);
    setMapping(result.suggestedMapping);
  }

  async function handleGenerate() {
    if (!parsed || "error" in parsed) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/reports/convert-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateHeaders: parsed.templateHeaders,
          mapping,
          dataRows: parsed.dataRows,
          outputFormat,
        }),
      });

      if (!response.ok) {
        setError("تعذر توليد الملف");
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

  return (
    <div className="max-w-3xl space-y-4.5">
      <PageHeader
        title="تحويل ملف حسب قالب"
        subtitle="ارفع ملف قالب (Excel أو Word) يحدّد شكل المخرجات، وملف بيانات Excel، ثم اربط الأعمدة واحصل على ملف واحد مُطابق للقالب"
        variant="teal"
        icon={<ChartIcon className="h-6 w-6" />}
      />

      <div className="rounded-[16px] border border-border bg-surface p-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">
              ملف القالب — Excel أو Word (يحدّد شكل الأعمدة النهائية)
            </span>
            <input ref={templateInputRef} type="file" accept=".xlsx,.docx" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-foreground">ملف البيانات المصدر (Excel)</span>
            <input ref={dataInputRef} type="file" accept=".xlsx" className={inputClass} />
          </label>
        </div>

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
