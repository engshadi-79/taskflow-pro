"use server";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export type ParsedExcelRow = Record<string, string | number | null>;

export type ParseTemplateResult =
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

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): (string | number | null)[] {
  const row = sheet.getRow(rowNumber);
  const values: (string | number | null)[] = [];
  for (let col = 1; col <= columnCount; col++) values.push(cellToPlainValue(row.getCell(col)));
  return values;
}

/** A row with 2+ filled cells that are all the *same* text is a merged/
 *  repeated title banner ("تقرير نتائج الاختبارات والدرجات" typed into every
 *  cell across the row), not a header row - real headers have distinct
 *  labels per column. */
function looksLikeHeaderRow(values: (string | number | null)[]): boolean {
  const nonEmpty = values.filter((v) => v != null && String(v).trim() !== "");
  if (nonEmpty.length < 2) return false;
  const distinct = new Set(nonEmpty.map((v) => String(v).trim()));
  return distinct.size > 1;
}

/** Scans the first few rows for one that looks like real column headers,
 *  skipping a leading title/banner row - falls back to row 1 (the previous
 *  fixed assumption) if nothing else looks better within that scan window. */
function findHeaderRowNumber(sheet: ExcelJS.Worksheet, columnCount: number): number {
  const maxScan = Math.min(10, Math.max(sheet.rowCount, 1));
  for (let r = 1; r <= maxScan; r++) {
    if (looksLikeHeaderRow(rowValues(sheet, r, columnCount))) return r;
  }
  return 1;
}

function extractSheetData(sheet: ExcelJS.Worksheet): { headers: string[]; rows: ParsedExcelRow[] } {
  const columnCount = Math.max(sheet.columnCount, sheet.getRow(1).cellCount);
  const headerRowNumber = findHeaderRowNumber(sheet, columnCount);

  const headers: string[] = rowValues(sheet, headerRowNumber, columnCount).map((raw, i) =>
    raw != null && String(raw).trim() ? String(raw).trim() : `عمود ${i + 1}`
  );

  const rows: ParsedExcelRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber || rows.length >= MAX_ROWS) return;
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
 * Reads only the header row of the FIRST table found in the .docx (a docx
 * is a zip; the document body lives at word/document.xml as OOXML). This is
 * a minimal reader, not a general OOXML parser - it doesn't handle nested
 * tables or merged cells, which is an acceptable v1 limit since all it needs
 * is the list of column names the template defines, not the document's
 * layout or any other content.
 */
async function extractHeadersFromDocxTable(buffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return [];

  const table = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  if (!table) return [];

  const headerRow = table.match(/<w:tr[\s\S]*?<\/w:tr>/)?.[0];
  if (!headerRow) return [];

  const cells = headerRow.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
  return cells.map((cellXml) => {
    const textRuns = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    return textRuns
      .map((run) => run.replace(/<[^>]+>/g, ""))
      .join("")
      .trim();
  });
}

function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx");
}

/**
 * Stateless by design: both files are parsed in this one request and never
 * written to Storage or a table - the browser holds the parsed rows/mapping
 * between this call and the generate step (see template-converter.tsx and
 * /api/reports/convert-template). Gated behind reports.build, the same
 * permission the custom Report Builder already uses. The template file may
 * be .xlsx (first sheet's header row) or .docx (first table's header row);
 * the data file is always .xlsx.
 */
export async function parseTemplateAndDataFiles(formData: FormData): Promise<ParseTemplateResult> {
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

    let templateHeaders: string[];
    if (isDocxFile(templateFile)) {
      templateHeaders = await extractHeadersFromDocxTable(templateBuffer);
      if (templateHeaders.length === 0) {
        return { error: "لم يتم العثور على جدول به صف عناوين في ملف الوورد" };
      }
    } else {
      const templateWorkbook = new ExcelJS.Workbook();
      await templateWorkbook.xlsx.load(templateBuffer);
      const templateSheet = templateWorkbook.worksheets[0];
      if (!templateSheet) return { error: "لم يتم العثور على أي ورقة في ملف القالب" };
      templateHeaders = extractSheetData(templateSheet).headers;
      if (templateHeaders.length === 0) return { error: "ملف القالب لا يحتوي على صف عناوين" };
    }

    const dataWorkbook = new ExcelJS.Workbook();
    await dataWorkbook.xlsx.load(dataBuffer);
    const dataSheet = dataWorkbook.worksheets[0];
    if (!dataSheet) return { error: "لم يتم العثور على أي ورقة في ملف البيانات" };

    const { headers: dataHeaders, rows: dataRows } = extractSheetData(dataSheet);
    if (dataHeaders.length === 0) return { error: "ملف البيانات لا يحتوي على صف عناوين" };

    return {
      templateHeaders,
      dataHeaders,
      dataRows,
      suggestedMapping: suggestColumnMapping(templateHeaders, dataHeaders),
      truncated: dataRows.length >= MAX_ROWS,
    };
  } catch {
    return { error: "تعذر قراءة أحد الملفين - تأكد أن القالب Excel أو Word صحيح وأن ملف البيانات بصيغة Excel (.xlsx)" };
  }
}
