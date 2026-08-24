/**
 * Pure file-parsing/generation helpers for the template converter, shared
 * between the "use server" actions file (which can only export async
 * functions) and the /api/reports/convert-template route handler. Nothing
 * here touches auth, Supabase, or Next.js - just ExcelJS/JSZip logic.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";

export const MAX_ROWS = 5000;

export type ParsedExcelRow = Record<string, string | number | null>;

/** Trim + unify the Arabic letter variants that otherwise make two visually
 *  identical header names compare as different strings ("الاسم" vs "الإسم"). */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

/** Best-effort auto-suggestion only - the user can override every mapping
 *  before generating, so this deliberately stays simple (exact match, then
 *  substring) rather than pulling in a fuzzy-distance library. */
export function suggestColumnMapping(templateHeaders: string[], dataHeaders: string[]): Record<string, string> {
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
 *  skipping a leading title/banner row - falls back to row 1 if nothing
 *  else looks better within that scan window. */
export function findHeaderRowNumber(sheet: ExcelJS.Worksheet, columnCount: number): number {
  const maxScan = Math.min(10, Math.max(sheet.rowCount, 1));
  for (let r = 1; r <= maxScan; r++) {
    if (looksLikeHeaderRow(rowValues(sheet, r, columnCount))) return r;
  }
  return 1;
}

export function extractSheetData(sheet: ExcelJS.Worksheet): { headers: string[]; rows: ParsedExcelRow[] } {
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
export async function extractHeadersFromDocxTable(buffer: ArrayBuffer): Promise<string[]> {
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

export function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx");
}

function mappedValue(header: string, mapping: Record<string, string>, row: ParsedExcelRow): string | number {
  const sourceKey = mapping[header];
  if (!sourceKey) return "";
  return row[sourceKey] ?? "";
}

/** `autoNumberHeader`, when it matches one of the template's own columns
 *  (typically "م"), replaces whatever that column would otherwise map to
 *  with a running counter instead - the caller resets `counter` to 1 at
 *  whatever boundary should restart numbering (once per document, or once
 *  per group when combined with groupByColumn). */
function buildRowValues(
  templateHeaders: string[],
  mapping: Record<string, string>,
  row: ParsedExcelRow,
  autoNumberHeader: string | undefined,
  counter: number
): (string | number)[] {
  return templateHeaders.map((header) => (header === autoNumberHeader ? counter : mappedValue(header, mapping, row)));
}

/**
 * Fills an uploaded .xlsx TEMPLATE in place - loads the real workbook (so
 * its letterhead, logo, merged title row, column widths, and any other
 * existing formatting survive untouched) and appends one new row per data
 * row directly after the sheet's existing content, instead of building a
 * brand-new bare workbook from scratch.
 */
export async function fillXlsxTemplate(
  templateBuffer: ArrayBuffer,
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[],
  options?: { autoNumberHeader?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("لم يتم العثور على أي ورقة في ملف القالب");

  let counter = 1;
  for (const row of dataRows) {
    sheet.addRow(buildRowValues(templateHeaders, mapping, row, options?.autoNumberHeader, counter));
    counter++;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** Stable grouping: preserves each group's first-appearance order and the
 *  original relative order of rows within a group (not an alphabetical
 *  sort), so "Group 1 rows, then Group 2 rows" comes out in whatever order
 *  those groups first appeared in the data file. */
export function groupRowsByColumn(dataRows: ParsedExcelRow[], column: string): ParsedExcelRow[][] {
  const order: string[] = [];
  const buckets = new Map<string, ParsedExcelRow[]>();
  for (const row of dataRows) {
    const key = String(row[column] ?? "");
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }
  return order.map((key) => buckets.get(key)!);
}

type TextRunSpan = { xmlStart: number; xmlEnd: number; openTag: string; text: string };

function extractTextRuns(xml: string): TextRunSpan[] {
  const runs: TextRunSpan[] = [];
  const regex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    runs.push({
      xmlStart: match.index,
      xmlEnd: match.index + match[0].length,
      openTag: `<w:t${match[1]}>`,
      text: decodeXmlEntities(match[2]),
    });
  }
  return runs;
}

/** Exact match first; otherwise falls back to the same normalized/substring
 *  fuzzy match already used for column mapping (suggestColumnMapping) - a
 *  template written as "{{المسار}}" should still resolve against a data
 *  column literally named "مسار" or "المسار الحالي", not just an exact
 *  "المسار" column. */
function resolvePlaceholderValue(key: string, values: Record<string, string>): string | undefined {
  if (key in values) return values[key];

  const normKey = normalizeHeader(key);
  const matchKey = Object.keys(values).find((k) => {
    const normK = normalizeHeader(k);
    return normK === normKey || normK.includes(normKey) || normKey.includes(normK);
  });
  return matchKey ? values[matchKey] : undefined;
}

/**
 * Replaces every {{columnName}} token found anywhere in this XML fragment's
 * visible text with the matching value from `values`, even when Word split
 * the token across multiple adjacent <w:t> runs (a common real-world docx
 * quirk - editing software frequently breaks a manually-typed run at
 * spellcheck/autocorrect boundaries). Locates each token in the
 * concatenated plain text first, then edits only the run(s) it actually
 * spans, leaving every other run, tag, and attribute untouched. An unknown
 * placeholder key (no exact or fuzzy match in `values`) is left as literal
 * text.
 */
function substitutePlaceholders(xml: string, values: Record<string, string>): string {
  const runs = extractTextRuns(xml);
  if (runs.length === 0) return xml;

  const runStartInFlat: number[] = [];
  let flat = "";
  for (const run of runs) {
    runStartInFlat.push(flat.length);
    flat += run.text;
  }

  const tokenRegex = /\{\{([^{}]+)\}\}/g;
  const newRunText = new Map<number, string>();
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(flat)) !== null) {
    const key = match[1].trim();
    const resolved = resolvePlaceholderValue(key, values);
    if (resolved === undefined) continue;

    const start = match.index;
    const end = match.index + match[0].length;
    let startRun = 0;
    while (startRun < runs.length - 1 && runStartInFlat[startRun + 1]! <= start) startRun++;
    let endRun = startRun;
    while (endRun < runs.length - 1 && runStartInFlat[endRun + 1]! < end) endRun++;

    const localStart = start - runStartInFlat[startRun]!;
    const localEnd = end - runStartInFlat[endRun]!;
    const value = resolved;

    if (startRun === endRun) {
      const current = newRunText.get(startRun) ?? runs[startRun]!.text;
      newRunText.set(startRun, current.slice(0, localStart) + value + current.slice(localEnd));
    } else {
      newRunText.set(startRun, runs[startRun]!.text.slice(0, localStart) + value);
      for (let i = startRun + 1; i < endRun; i++) newRunText.set(i, "");
      newRunText.set(endRun, runs[endRun]!.text.slice(localEnd));
    }
  }

  if (newRunText.size === 0) return xml;

  // Apply from the last edited run back to the first so earlier xmlStart/
  // xmlEnd offsets stay valid as each splice happens (splicing later text
  // never shifts positions before it).
  let result = xml;
  for (const idx of [...newRunText.keys()].sort((a, b) => b - a)) {
    const run = runs[idx]!;
    result = result.slice(0, run.xmlStart) + run.openTag + escapeXml(newRunText.get(idx)!) + "</w:t>" + result.slice(run.xmlEnd);
  }
  return result;
}

function rowToPlaceholderValues(row: ParsedExcelRow | undefined): Record<string, string> {
  const values: Record<string, string> = {};
  if (!row) return values;
  for (const [key, value] of Object.entries(row)) values[key] = value == null ? "" : String(value);
  return values;
}

/**
 * Fills an uploaded .docx TEMPLATE's table in place - keeps everything in
 * the document outside the table (letterhead, logo, title paragraphs)
 * completely untouched, keeps the table's own header row exactly as
 * designed, and generates one row per data row by cloning the table's LAST
 * existing row (its own cell borders/fonts/shading) rather than building a
 * bare table from scratch. If the template only has a header row and no
 * second "example" row, the header row itself is cloned as the style
 * source - a reasonable fallback, not a perfect one.
 *
 * Two optional behaviors, both driven by the raw source data (not the
 * template-header mapping):
 * - Any `{{columnName}}` text found in the letterhead is replaced with that
 *   column's value from the data file (e.g. a template reading "مسار
 *   {{المسار}}" picks up the real track name instead of whatever static
 *   text the template author typed).
 * - `groupByColumn`, when given, splits the data into groups (stable order
 *   of first appearance) and repeats the letterhead + header row once per
 *   group before that group's rows - so switching from one group to the
 *   next reprints the template's own title/heading section, without an
 *   actual page break.
 */
export async function fillDocxTemplate(
  templateBuffer: ArrayBuffer,
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[],
  options?: { groupByColumn?: string; autoNumberHeader?: string }
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentPath = "word/document.xml";
  const xml = await zip.file(documentPath)?.async("string");
  if (!xml) throw new Error("ملف الوورد غير صالح");

  const tableXml = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  if (!tableXml) throw new Error("لم يتم العثور على جدول في ملف القالب");

  const tableStart = xml.indexOf(tableXml);
  const tableEnd = tableStart + tableXml.length;

  // <w:body> itself must appear exactly once - only the letterhead content
  // *after* it (and before the table) is safe to repeat per group.
  const bodyOpenMatch = xml.match(/<w:body[^>]*>/);
  const bodyContentStart = bodyOpenMatch ? bodyOpenMatch.index! + bodyOpenMatch[0].length : 0;
  const documentOpenXml = xml.slice(0, bodyContentStart);
  const letterheadXml = xml.slice(bodyContentStart, tableStart);
  const trailingXml = xml.slice(tableEnd);

  const rowMatches = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
  if (rowMatches.length === 0) throw new Error("لم يتم العثور على صفوف في جدول القالب");

  const headerRowXml: string = rowMatches[0]!;
  const styleRowXml: string = rowMatches.length > 1 ? rowMatches[rowMatches.length - 1]! : headerRowXml;
  const styleCells = styleRowXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
  const rowOpenTag = styleRowXml.match(/^<w:tr[^>]*>/)?.[0] ?? "<w:tr>";
  const tableOpenPart = tableXml.slice(0, tableXml.indexOf(headerRowXml));

  function buildRow(values: (string | number)[]): string {
    const cellsXml = styleCells.map((cellXml, i) => {
      const text = escapeXml(String(values[i] ?? ""));
      let replaced = false;
      const withValue = cellXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_match, attrs: string) => {
        if (!replaced) {
          replaced = true;
          return `<w:t${attrs}>${text}</w:t>`;
        }
        return `<w:t${attrs}></w:t>`;
      });
      // A style-source cell with no text run at all (an empty placeholder
      // cell) still needs the value inserted somewhere visible.
      if (!replaced) {
        return withValue.replace(/<\/w:tc>$/, `<w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`);
      }
      return withValue;
    });
    return `${rowOpenTag}${cellsXml.join("")}</w:tr>`;
  }

  const groups = options?.groupByColumn ? groupRowsByColumn(dataRows, options.groupByColumn) : [dataRows];

  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  const sections = groups
    .map((groupRows, index) => {
      // Numbering restarts at 1 for each group (or once, if ungrouped) -
      // matches "كل مجموعة ترقيم جديد" rather than a single running count
      // across the whole document.
      let counter = 1;
      const generatedRows = groupRows
        .map((row) => buildRowValues(templateHeaders, mapping, row, options?.autoNumberHeader, counter++))
        .map(buildRow)
        .join("");
      const sectionLetterhead = substitutePlaceholders(letterheadXml, rowToPlaceholderValues(groupRows[0]));
      const sectionTable = `${tableOpenPart}${headerRowXml}${generatedRows}</w:tbl>`;
      // Every group after the first starts on its own fresh page - only the
      // very first section is already at the top of page 1 by definition.
      const pageBreak = index > 0 ? PAGE_BREAK : "";
      return `${pageBreak}${sectionLetterhead}${sectionTable}`;
    })
    .join("");

  const newXml = `${documentOpenXml}${sections}${trailingXml}`;

  zip.file(documentPath, newXml);
  return zip.generateAsync({ type: "nodebuffer" });
}
