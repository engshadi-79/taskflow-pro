"use server";

import ExcelJS from "exceljs";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export type ParsedExcelRow = Record<string, string | number | null>;

export type ParseExcelResult =
  | { error: string }
  | {
      templateHeaders: string[];
      dataHeaders: string[];
      dataRows: ParsedExcelRow[];
      suggestedMapping: Record<string, string>;
      truncated: boolean;
    };

/** Trim + unify the Arabic letter variants that otherwise make two visually
 *  identical header names compare as different strings ("الاسم" vs "الإسم"). */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

/** Best-effort auto-suggestion only - the user can override every mapping
 *  before generating, so this deliberately stays simple (exact match, then
 *  substring) rather than pulling in a fuzzy-distance library. */
function suggestColumnMapping(templateHeaders: string[], dataHeaders: string[]): Record<string, string> {
  const normalizedData = dataHeaders.map((raw) => ({ raw, norm: normalizeHeader(raw) }));
  const mapping: Record<string, string> = {};

  for (const templateHeader of templateHeaders) {
    const normTemplate = normalizeHeader(templateHeader);
    const exact = normalizedData.find((d) => d.norm === normTemplate);
    if (exact) {
      mapping[templateHeader] = exact.raw;
      continue;
    }
    const partial = normalizedData.find((d) => d.norm.includes(normTemplate) || normTemplate.includes(d.norm));
    if (partial) mapping[templateHeader] = partial.raw;
  }

  return mapping;
}

function cellToPlainValue(cell: ExcelJS.Cell): string | number | null {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return (value.result as string | number | null) ?? null;
    return String(value);
  }
  return value as string | number;
}

function extractSheetData(sheet: ExcelJS.Worksheet): { headers: string[]; rows: ParsedExcelRow[] } {
  const headerRow = sheet.getRow(1);
  const columnCount = Math.max(sheet.columnCount, headerRow.cellCount);
  const headers: string[] = [];
  for (let col = 1; col <= columnCount; col++) {
    const raw = cellToPlainValue(headerRow.getCell(col));
    headers.push(raw != null && String(raw).trim() ? String(raw).trim() : `عمود ${col}`);
  }

  const rows: ParsedExcelRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= MAX_ROWS) return;
    const record: ParsedExcelRow = {};
    let hasValue = false;
    for (let col = 1; col <= columnCount; col++) {
      const value = cellToPlainValue(row.getCell(col));
      if (value != null && value !== "") hasValue = true;
      record[headers[col - 1]] = value;
    }
    if (hasValue) rows.push(record);
  });

  return { headers, rows };
}

/**
 * Stateless by design: both files are parsed in this one request and never
 * written to Storage or a table - the browser holds the parsed rows/mapping
 * between this call and the generate step (see excel-converter.tsx and
 * /api/reports/convert-excel). Gated behind reports.build, the same
 * permission the custom Report Builder already uses.
 */
export async function parseExcelFiles(formData: FormData): Promise<ParseExcelResult> {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return { error: "غير مصرح لك باستخدام هذه الأداة" };
  }

  const templateFile = formData.get("templateFile") as File | null;
  const dataFile = formData.get("dataFile") as File | null;

  if (!templateFile || !dataFile) {
    return { error: "يجب اختيار ملف القالب وملف البيانات معًا" };
  }
  if (templateFile.size > MAX_FILE_BYTES || dataFile.size > MAX_FILE_BYTES) {
    return { error: "الحد الأقصى لحجم كل ملف 5 ميجابايت" };
  }

  try {
    const [templateBuffer, dataBuffer] = await Promise.all([
      templateFile.arrayBuffer(),
      dataFile.arrayBuffer(),
    ]);

    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(templateBuffer);
    const templateSheet = templateWorkbook.worksheets[0];
    if (!templateSheet) return { error: "لم يتم العثور على أي ورقة في ملف القالب" };

    const dataWorkbook = new ExcelJS.Workbook();
    await dataWorkbook.xlsx.load(dataBuffer);
    const dataSheet = dataWorkbook.worksheets[0];
    if (!dataSheet) return { error: "لم يتم العثور على أي ورقة في ملف البيانات" };

    const { headers: templateHeaders } = extractSheetData(templateSheet);
    const { headers: dataHeaders, rows: dataRows } = extractSheetData(dataSheet);

    if (templateHeaders.length === 0) return { error: "ملف القالب لا يحتوي على صف عناوين" };
    if (dataHeaders.length === 0) return { error: "ملف البيانات لا يحتوي على صف عناوين" };

    return {
      templateHeaders,
      dataHeaders,
      dataRows,
      suggestedMapping: suggestColumnMapping(templateHeaders, dataHeaders),
      truncated: dataRows.length >= MAX_ROWS,
    };
  } catch {
    return { error: "تعذر قراءة أحد الملفين - تأكد أنهما بصيغة Excel صحيحة (.xlsx)" };
  }
}
