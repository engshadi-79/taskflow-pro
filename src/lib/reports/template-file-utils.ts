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
    if ("error" in value) return null;
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

const DATE_CELL_PATTERN = /^\d{1,2}\/\d{1,2}/;

/** A row of pre-formatted session-date headers ("02/08\nالأحد" per cell) has
 *  distinct values just like a real header row, but it isn't one - a
 *  template can have both (a date row above the real column-header row, as
 *  in the attendance-sheet template), so this must be excluded from header
 *  candidacy explicitly rather than relying on "first distinct row wins". */
function looksLikeDateRow(values: (string | number | null)[]): boolean {
  const nonEmpty = values.filter((v) => v != null && String(v).trim() !== "");
  const dateLike = nonEmpty.filter((v) => DATE_CELL_PATTERN.test(String(v).trim()));
  return dateLike.length >= 3;
}

/** Scans the first few rows for one that looks like real column headers,
 *  skipping a leading title/banner row and any session-date row - falls
 *  back to row 1 if nothing else looks better within that scan window. */
export function findHeaderRowNumber(sheet: ExcelJS.Worksheet, columnCount: number): number {
  const maxScan = Math.min(10, Math.max(sheet.rowCount, 1));
  for (let r = 1; r <= maxScan; r++) {
    const values = rowValues(sheet, r, columnCount);
    if (looksLikeHeaderRow(values) && !looksLikeDateRow(values)) return r;
  }
  return 1;
}

/** Scans the rows above the detected header for a pre-formatted session-date
 *  row (e.g. "02/08\nالأحد" per cell) - returns null when the template has
 *  none, meaning the date-generation feature simply doesn't apply to it. */
export function findDateRowNumber(sheet: ExcelJS.Worksheet, columnCount: number, headerRowNumber: number): number | null {
  for (let r = 1; r < headerRowNumber; r++) {
    if (looksLikeDateRow(rowValues(sheet, r, columnCount))) return r;
  }
  return null;
}

const ARABIC_WEEKDAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** "YYYY-MM-DD" (what an <input type="date"> sends) parsed as a LOCAL date,
 *  not via `new Date(iso)` - that parses as UTC midnight, which shifts to
 *  the previous day once read back through local getDate()/getDay() in any
 *  timezone behind UTC. */
function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Pure calendar walk: collects up to `maxCount` days between `startDate`
 *  and `endDate` (inclusive, both "YYYY-MM-DD") whose weekday (0=Sunday..
 *  6=Saturday, matching Date#getDay()) is in `weekdays`, formatted to match
 *  the template's own "DD/MM\nWeekday" text pattern exactly. A short or
 *  oddly-aligned range (e.g. exactly half a month) can legitimately contain
 *  fewer matching days than the template's column count - that's fine, the
 *  caller fills only as many date cells as were found; this only throws
 *  when the range contains *no* matching day at all, since that's the one
 *  case that's unambiguously a misconfiguration (wrong weekday(s) picked
 *  for this range). */
export function computeSessionDates(startDate: string, endDate: string, weekdays: number[], maxCount = 7): string[] {
  const weekdaySet = new Set(weekdays);
  const end = parseIsoDateLocal(endDate);
  const cursor = parseIsoDateLocal(startDate);
  const labels: string[] = [];

  // A reversed range (start after end) makes the loop below never run even
  // once, which used to surface as the same "no matching day" message as a
  // genuinely empty weekday match - misleading, since the actual mistake is
  // the two date fields themselves, not the weekday selection.
  if (cursor > end) {
    throw new Error("تاريخ البداية بعد تاريخ النهاية - تأكد من ترتيب الحقلين \"من تاريخ\" و\"إلى تاريخ\"");
  }

  while (cursor <= end && labels.length < maxCount) {
    if (weekdaySet.has(cursor.getDay())) {
      const dd = String(cursor.getDate()).padStart(2, "0");
      const mm = String(cursor.getMonth() + 1).padStart(2, "0");
      labels.push(`${dd}/${mm}\n${ARABIC_WEEKDAY_NAMES[cursor.getDay()]}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (labels.length === 0) {
    throw new Error("لا يوجد أي يوم يوافق الأيام المحددة ضمن هذا المدى الزمني");
  }
  return labels;
}

const ARABIC_MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** Sorting position for a weekday (0=Sunday..6=Saturday, Date#getDay()'s own
 *  numbering) within a week that starts on Saturday - only used for
 *  DISPLAY ordering of the {{الأيام}} label, never for the actual calendar
 *  walk in computeSessionDates, which is date-based and has no "week start"
 *  concept to begin with. */
function weekPositionFromSaturday(weekday: number): number {
  return (weekday + 1) % 7;
}

/** "شهر سنة" (e.g. "سبتمبر 2026") from a "YYYY-MM-DD" date - used to name
 *  the downloaded file after the period it covers, same month/year this
 *  generation's own {{الشهر}}/{{السنة}} placeholders resolve to. */
export function formatMonthYearArabic(startDate: string): string {
  const start = parseIsoDateLocal(startDate);
  const month = ARABIC_MONTH_NAMES[start.getMonth()] ?? String(start.getMonth() + 1);
  return `${month} ${start.getFullYear()}`;
}

/** {{الشهر}}/{{السنة}}/{{الأيام}} describe the whole generation run, not any
 *  one data row, so they can't come from rowToPlaceholderValues - computed
 *  once and merged into every group's placeholder values instead. Derived
 *  from the range's start date - a range spanning two calendar months still
 *  resolves to just the starting one, an accepted v1 simplification. */
function sessionDatePlaceholders(startDate: string, weekdays: number[]): Record<string, string> {
  const start = parseIsoDateLocal(startDate);
  return {
    الشهر: ARABIC_MONTH_NAMES[start.getMonth()] ?? String(start.getMonth() + 1),
    السنة: String(start.getFullYear()),
    الأيام: [...weekdays]
      .sort((a, b) => weekPositionFromSaturday(a) - weekPositionFromSaturday(b))
      .map((d) => ARABIC_WEEKDAY_NAMES[d])
      .join(" - "),
  };
}

/** Finds a session-date row's own existing non-empty cells - one target per
 *  logical date cell, not per physical column. A real attendance template
 *  typically merges each date across several columns (one per
 *  حضور/خروج/توقيع sub-column beneath it), so every column inside that merge
 *  reports the same non-empty value; counting each of those separately would
 *  both wildly overcount how many dates to generate and, since a merged
 *  range only ever has one real cell (the others are ExcelJS-managed slaves
 *  that redirect writes to it), end up overwriting that one cell 2-3 times
 *  in a row with only the last write surviving. Only a merge's own master
 *  column counts as a target; a plain unmerged non-empty cell (a template
 *  with one column per date, no merge) still counts as before. */
function dateRowTargetColumns(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): number[] {
  const row = sheet.getRow(rowNumber);
  const cols: number[] = [];
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    const value = cellToPlainValue(cell);
    if (value == null || String(value).trim() === "") continue;
    if (cell.isMerged && cell.master.fullAddress.col !== col) continue;
    cols.push(col);
  }
  return cols;
}

/** Overwrites a session-date row's own existing non-empty cells, left to
 *  right, with freshly computed labels - only `.value`, never `.style`, so
 *  each cell's existing formatting survives untouched. When there are
 *  fewer labels than cells (a short date range didn't fill every column),
 *  the remaining cells are blanked rather than left holding the template's
 *  original dummy dates. */
function applyDatesToRow(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number, labels: string[]): void {
  const row = sheet.getRow(rowNumber);
  const targetCols = dateRowTargetColumns(sheet, rowNumber, columnCount);
  targetCols.forEach((col, i) => {
    row.getCell(col).value = i < labels.length ? labels[i]! : "";
  });
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

/** Real-world spreadsheets routinely carry stray leading/trailing spaces
 *  from manual data entry (copy-pasted names, a trailing space after
 *  someone's last edit) - invisible in the source file's own cells but very
 *  visible once inserted into a generated row of its own, so trimmed here
 *  rather than passed through as-is. Numbers are returned untouched (no
 *  string coercion needed, nothing to trim). */
function mappedValue(header: string, mapping: Record<string, string>, row: ParsedExcelRow): string | number {
  const sourceKey = mapping[header];
  if (!sourceKey) return "";
  const value = row[sourceKey] ?? "";
  return typeof value === "string" ? value.trim() : value;
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

type CellSnapshot = { value: ExcelJS.CellValue; style: Partial<ExcelJS.Style> };

function snapshotRow(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): CellSnapshot[] {
  const row = sheet.getRow(rowNumber);
  const cells: CellSnapshot[] = [];
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    cells.push({ value: cell.value, style: { ...cell.style } });
  }
  return cells;
}

/** Shifts both row numbers of an "A1:B3"-style merge range by `rowOffset`,
 *  leaving the column letters untouched - used to reproduce a captured
 *  merge at wherever a duplicated header block lands further down the
 *  sheet. Returns the range unchanged if it doesn't match the expected
 *  shape (defensive - should never happen for merges read back from
 *  ExcelJS itself). */
function shiftMergeRange(range: string, rowOffset: number): string {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return range;
  const [, colA, rowA, colB, rowB] = match;
  return `${colA}${Number(rowA) + rowOffset}:${colB}${Number(rowB) + rowOffset}`;
}

type AnchorSnapshot = { nativeCol: number; nativeColOff: number; nativeRow: number; nativeRowOff: number };
type ImageSnapshot = { imageId: number; tl: AnchorSnapshot; br: AnchorSnapshot | null; editAs: string | undefined };

/** Captures any image (a logo in the letterhead, typically) anchored within
 *  the header block, in ExcelJS's own native-anchor shape - snapshotRow only
 *  ever sees cell values/styles, so an image would otherwise only survive in
 *  the first group's copy of the block, not any duplicated one. */
function toAnchorSnapshot(anchor: ExcelJS.Anchor): AnchorSnapshot {
  return {
    nativeCol: anchor.nativeCol,
    nativeColOff: anchor.nativeColOff,
    nativeRow: anchor.nativeRow,
    nativeRowOff: anchor.nativeRowOff,
  };
}

function snapshotBlockImages(sheet: ExcelJS.Worksheet, blockEndRow: number): ImageSnapshot[] {
  return sheet
    .getImages()
    .filter((img) => img.range.tl.nativeRow < blockEndRow)
    .map((img) => ({
      imageId: Number(img.imageId),
      tl: toAnchorSnapshot(img.range.tl),
      br: img.range.br ? toAnchorSnapshot(img.range.br) : null,
      editAs: (img.range as unknown as { editAs?: string }).editAs,
    }));
}

/** Re-anchors each captured image `rowOffset` rows down for a duplicated
 *  group copy - ExcelJS's Anchor constructor accepts this native-offset
 *  shape directly (confirmed against this ExcelJS version), even though its
 *  own addImage() types only advertise the simpler {col,row} position or a
 *  real Anchor instance. */
function addShiftedImages(sheet: ExcelJS.Worksheet, images: ImageSnapshot[], rowOffset: number): void {
  for (const img of images) {
    const range = {
      tl: { ...img.tl, nativeRow: img.tl.nativeRow + rowOffset },
      br: img.br ? { ...img.br, nativeRow: img.br.nativeRow + rowOffset } : undefined,
      editAs: img.editAs,
    };
    sheet.addImage(img.imageId, range as unknown as Parameters<ExcelJS.Worksheet["addImage"]>[1]);
  }
}

/** Cell-level counterpart to substitutePlaceholders (which operates on raw
 *  Word OOXML text runs) - replaces {{columnName}} tokens found in any
 *  cell's own text within one row, in place, leaving cells with no token
 *  untouched. Applied per-row (not per-workbook) because each repeated
 *  header-block copy needs its own group's values substituted in. */
function substituteCellPlaceholdersInRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
  values: Record<string, string>
): void {
  const row = sheet.getRow(rowNumber);
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    const raw = cellToPlainValue(cell);
    if (typeof raw !== "string" || !raw.includes("{{")) continue;
    const replaced = raw.replace(/\{\{([^{}]+)\}\}/g, (full, key: string) => {
      const resolved = resolvePlaceholderValue(key.trim(), values);
      return resolved === undefined ? full : resolved;
    });
    if (replaced !== raw) cell.value = replaced;
  }
}

/** Resolves which weekdays apply to one group: a per-group override keyed by
 *  the same compound key groupByColumns/computeGroupKey produce, falling
 *  back to a single flat weekday list when the whole file shares one
 *  schedule (no grouping, or every group meets on the same days). Throws a
 *  clear, named error rather than silently falling back to nothing, since a
 *  missing schedule would otherwise generate wrong dates without any sign
 *  something was misconfigured. */
function resolveGroupWeekdays(
  sessionDates: { weekdays?: number[]; weekdaysByGroup?: Record<string, number[]> },
  groupByColumns: string[] | undefined,
  groupRow: ParsedExcelRow | undefined
): number[] {
  const groupKey = groupByColumns?.length ? computeGroupKey(groupByColumns, groupRow ?? {}) : undefined;
  const weekdays = (groupKey ? sessionDates.weekdaysByGroup?.[groupKey] : undefined) ?? sessionDates.weekdays;
  if (!weekdays || weekdays.length === 0) {
    throw new Error(
      groupKey
        ? `لم يتم تحديد أيام الأسبوع لهذه المجموعة: ${groupKey.replace(/ \|\|\| /g, " - ")}`
        : "لم يتم تحديد أيام الأسبوع لتوليد التواريخ"
    );
  }
  return weekdays;
}

/**
 * Fills an uploaded .xlsx TEMPLATE in place - loads the real workbook (so
 * its letterhead, logo, merged title row, column widths, and any other
 * existing formatting survive untouched), removes whatever example rows the
 * template shipped below its header, and rebuilds the body from the real
 * data.
 *
 * Mirrors fillDocxTemplate's grouping/placeholder design (see its own
 * comment) but with ExcelJS's row/cell/merge APIs instead of raw OOXML
 * string slicing - with one deliberate difference: fillDocxTemplate repeats
 * its whole letterhead per group because each group becomes its own printed
 * Word page, but a multi-group Excel sheet is one continuous scroll, so only
 * the placeholder row(s) right below the column-header row (a group-title
 * row, typically) repeat per group. Both the letterhead (title/logo/
 * subtitle, and a date row if it lives up there) *and* the column-header
 * row itself are written exactly once, at the top. The first group's own
 * placeholder row(s) are substituted in place; each later group gets a
 * freshly duplicated copy (values + styles + merges) of just that row, plus
 * a real print page break, so a printed copy still starts each group on its
 * own page even though the letterhead above it doesn't reprint.
 *
 * `groupByColumns` groups by the *combination* of several data columns at
 * once (e.g. track + group together), so each section is one specific
 * track/group pair rather than mixing rows that only share one of the two.
 *
 * `sortRowsBy`, when given, sorts each group's rows independently (Arabic
 * locale-aware) by that data column - never across groups, and the
 * auto-number column (if any) still restarts at 1 per group afterward.
 *
 * `sessionDates`, when given, overwrites a pre-formatted date-header row
 * (found above the column-header row) with freshly computed dates - done
 * separately for every group's own header-block copy (not once globally),
 * since different groups can meet on different weekdays via
 * `weekdaysByGroup` while still sharing the same `startDate`/`endDate`
 * range (e.g. generating just the first half of a month's sheet, then the
 * second half as its own separate run).
 */
export async function fillXlsxTemplate(
  templateBuffer: ArrayBuffer,
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[],
  options?: {
    groupByColumns?: string[];
    autoNumberHeader?: string;
    sortRowsBy?: string;
    sessionDates?: {
      startDate: string;
      endDate: string;
      weekdays?: number[];
      weekdaysByGroup?: Record<string, number[]>;
    };
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("لم يتم العثور على أي ورقة في ملف القالب");

  const columnCount = Math.max(sheet.columnCount, sheet.getRow(1).cellCount, templateHeaders.length);
  const headerRowNumber = findHeaderRowNumber(sheet, columnCount);

  let dateRowNumber: number | null = null;
  let dateColumnCount = 0;
  if (options?.sessionDates) {
    dateRowNumber = findDateRowNumber(sheet, columnCount, headerRowNumber);
    if (dateRowNumber == null) throw new Error("لم يتم العثور على صف تواريخ في هذا القالب");
    dateColumnCount = dateRowTargetColumns(sheet, dateRowNumber, columnCount).length;
  }
  // Every group sharing the same dates (no weekdaysByGroup, or a template
  // with no date row at all) is the common case: the whole letterhead -
  // title, subtitle, the date row if any - is written once, at the top,
  // never duplicated. weekdaysByGroup means groups genuinely meet on
  // different days, so each one needs its own complete letterhead (its own
  // title text naming *its* days, its own date row, its own column-header
  // row) - a single shared title couldn't honestly describe every group's
  // schedule at once, so at that point nothing above the group stays
  // shared; the whole block repeats per group instead.
  const perGroupDates = dateRowNumber != null && !!options?.sessionDates?.weekdaysByGroup;

  // A template's own "repeat these rows on every printed page" setting
  // (Excel's Print Titles) makes sense for the shared-letterhead case - it's
  // the only way page 2+ of a long single-schedule roster still shows the
  // column headers when printed, since the real header row only exists
  // once, physically, at the top. In perGroupDates mode that reasoning
  // flips: every group already carries its own full letterhead inline, so
  // Print Titles would instead paste whichever group happens to sit at the
  // very top of the sheet onto every other group's printed pages too -
  // disabled here rather than left to silently duplicate/misattribute it.
  if (perGroupDates) {
    sheet.pageSetup.printTitlesRow = undefined;
    sheet.pageSetup.printTitlesColumn = undefined;
  }

  // Rows above the one-time "written once" section - normally the title/
  // subtitle/date row above the column-header row. None of it is ever
  // duplicated in the common case: a multi-group attendance sheet is one
  // continuous workbook someone scrolls through, not a stack of separately-
  // printed pages each needing its own copy of the logo/title (unlike
  // fillDocxTemplate's Word pages, which are exactly that). perGroupDates
  // is the one exception - see repeatStartRow below.
  const letterheadEndRow = perGroupDates ? 0 : headerRowNumber - 1;

  let blockEndRow = headerRowNumber;
  while (blockEndRow < sheet.rowCount) {
    const nextRowValues = rowValues(sheet, blockEndRow + 1, columnCount);
    const hasPlaceholder = nextRowValues.some((v) => typeof v === "string" && /\{\{[^{}]+\}\}/.test(v));
    if (!hasPlaceholder) break;
    blockEndRow++;
  }
  const firstDataRow = blockEndRow + 1;

  // Style source for generated data rows: the template's own first example
  // row if it shipped with one, otherwise fall back to the header row's own
  // styling (mirrors fillDocxTemplate's equivalent fallback).
  const styleSourceRow = firstDataRow <= sheet.rowCount ? firstDataRow : headerRowNumber;
  const dataCellStyles: Partial<ExcelJS.Style>[] = [];
  for (let col = 1; col <= columnCount; col++) {
    dataCellStyles.push({ ...sheet.getRow(styleSourceRow).getCell(col).style });
  }

  // The repeating unit is normally just the placeholder row(s) below the
  // column headers (e.g. a group-title row) - NOT the column-header row
  // itself and NOT the letterhead above it, both written once at the top
  // ("م / اسم الطالب / ساعة الحضور..." doesn't need reprinting mid-sheet for
  // every group, only the group's own title row does). When groups meet on
  // different days (perGroupDates), the *entire* block from row 1 down
  // joins the repeating unit instead - title, subtitle, date row, and
  // column-header row all repeat per group, each with that group's own
  // day names and dates substituted in.
  const repeatStartRow = perGroupDates ? 1 : headerRowNumber + 1;
  const blockSnapshot: CellSnapshot[][] = [];
  for (let r = repeatStartRow; r <= blockEndRow; r++) blockSnapshot.push(snapshotRow(sheet, r, columnCount));
  const blockMerges = (sheet.model.merges ?? []).filter((range) => {
    const match = range.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
    return match != null && Number(match[1]) >= repeatStartRow && Number(match[2]) <= blockEndRow;
  });
  // A logo/letterhead image sits in the letterhead itself in every template
  // seen so far, so it's excluded the same way the letterhead's cells are -
  // this only captures an image anchored *inside* the repeating block
  // (uncommon, but kept for symmetry with blockMerges/blockSnapshot above).
  const blockImages = snapshotBlockImages(sheet, blockEndRow).filter((img) => img.tl.nativeRow >= repeatStartRow - 1);

  // Drop whatever example rows the template shipped below its header - the
  // real uploaded roster replaces them entirely, it doesn't append after.
  // ExcelJS's spliceRows silently no-ops when the deleted range runs all the
  // way to the sheet's own last row (it only shifts rows that exist *after*
  // the deleted range down to fill the gap, so with nothing after there's
  // nothing to shift) - confirmed directly against this ExcelJS version, so
  // the internal row array is truncated explicitly as well to actually drop
  // the trailing rows instead of leaving them in place.
  if (firstDataRow <= sheet.rowCount) {
    sheet.spliceRows(firstDataRow, sheet.rowCount - firstDataRow + 1);
    (sheet as unknown as { _rows: unknown[] })._rows.length = firstDataRow - 1;
  }

  function addDataRow(row: ParsedExcelRow, counter: number): void {
    const values = buildRowValues(templateHeaders, mapping, row, options?.autoNumberHeader, counter);
    const newRow = sheet.addRow(values);
    for (let col = 1; col <= columnCount; col++) newRow.getCell(col).style = dataCellStyles[col - 1]!;
  }

  function placeholderValuesFor(row: ParsedExcelRow | undefined, extra: Record<string, string>): Record<string, string> {
    return { ...rowToPlaceholderValues(row), ...extra };
  }

  const groups = options?.groupByColumns?.length ? groupRowsByColumns(dataRows, options.groupByColumns) : [dataRows];
  // Sorted independently within each group (never across groups) - the
  // auto-number column, when present, still starts at 1 per group after
  // sorting, exactly as it would for the original unsorted order.
  if (options?.sortRowsBy) {
    const sortColumn = options.sortRowsBy;
    for (const groupRows of groups) {
      groupRows.sort((a, b) =>
        String(a[sortColumn] ?? "").trim().localeCompare(String(b[sortColumn] ?? "").trim(), "ar")
      );
    }
  }

  // Letterhead: written exactly once, using the first group's row for any
  // placeholder that happens to reference a data column (uncommon - the
  // letterhead is normally workbook-level text like the month/year) plus
  // the shared date labels when this template's date row lives up here.
  // Never runs when perGroupDates - there letterheadEndRow is 0, since the
  // whole block (including this title/date row) repeats per group instead,
  // each with its own day names and dates, further down in the loop below.
  if (letterheadEndRow >= 1) {
    let letterheadExtra: Record<string, string> = {};
    if (dateRowNumber != null && options?.sessionDates) {
      const weekdays = resolveGroupWeekdays(options.sessionDates, options.groupByColumns, dataRows[0]);
      const dateLabels = computeSessionDates(options.sessionDates.startDate, options.sessionDates.endDate, weekdays, dateColumnCount);
      letterheadExtra = sessionDatePlaceholders(options.sessionDates.startDate, weekdays);
      applyDatesToRow(sheet, dateRowNumber, columnCount, dateLabels);
    }
    for (let r = 1; r <= letterheadEndRow; r++) {
      substituteCellPlaceholdersInRow(sheet, r, columnCount, placeholderValuesFor(dataRows[0], letterheadExtra));
    }
  }

  groups.forEach((groupRows, index) => {
    let extraPlaceholders: Record<string, string> = {};
    let dateLabels: string[] | null = null;
    // Shared dates were already written once, above, in the letterhead -
    // only per-group dates (weekdaysByGroup) get computed again here.
    if (options?.sessionDates && perGroupDates) {
      const weekdays = resolveGroupWeekdays(options.sessionDates, options.groupByColumns, groupRows[0]);
      dateLabels = computeSessionDates(options.sessionDates.startDate, options.sessionDates.endDate, weekdays, dateColumnCount);
      extraPlaceholders = sessionDatePlaceholders(options.sessionDates.startDate, weekdays);
    }

    if (index === 0) {
      // The original block is still sitting untouched at the top of the
      // sheet - substitute its placeholders in place rather than
      // duplicating a fresh copy of it.
      for (let r = repeatStartRow; r <= blockEndRow; r++) {
        substituteCellPlaceholdersInRow(sheet, r, columnCount, placeholderValuesFor(groupRows[0], extraPlaceholders));
      }
      if (dateLabels) applyDatesToRow(sheet, dateRowNumber!, columnCount, dateLabels);
    } else {
      // Every group after the first starts on its own fresh printed page -
      // only the very first section is already at the top of page 1. Only
      // the repeating block (header + group-title row) is duplicated here,
      // never the letterhead above it.
      sheet.getRow(sheet.rowCount).addPageBreak();

      const insertStartRow = sheet.rowCount + 1;
      for (const cells of blockSnapshot) {
        const newRow = sheet.addRow(cells.map((c) => c.value));
        cells.forEach((c, i) => (newRow.getCell(i + 1).style = c.style));
      }
      const rowOffset = insertStartRow - repeatStartRow;
      for (const range of blockMerges) sheet.mergeCells(shiftMergeRange(range, rowOffset));
      addShiftedImages(sheet, blockImages, rowOffset);
      const blockRowCount = blockEndRow - repeatStartRow + 1;
      for (let r = insertStartRow; r <= insertStartRow + blockRowCount - 1; r++) {
        substituteCellPlaceholdersInRow(sheet, r, columnCount, placeholderValuesFor(groupRows[0], extraPlaceholders));
      }
      if (dateLabels) applyDatesToRow(sheet, insertStartRow + (dateRowNumber! - repeatStartRow), columnCount, dateLabels);
    }

    let counter = 1;
    for (const row of groupRows) addDataRow(row, counter++);
  });

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
    // Trimmed - an untrimmed source column (e.g. "المجموعة الثانية " with a
    // trailing space on some rows but not others) would otherwise silently
    // split one real group into several near-identical keys, each ending up
    // as its own separate, undersized section instead of one combined one.
    const key = String(row[column] ?? "").trim();
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }
  return order.map((key) => buckets.get(key)!);
}

const GROUP_KEY_SEPARATOR = " ||| ";

/** Compound key for grouping by more than one data column at once (e.g.
 *  track + group together, so each output section is one specific
 *  track/group combination) - also used as the lookup key for a per-group
 *  weekday schedule, so the client and server must compute it identically. */
export function computeGroupKey(columns: string[], row: ParsedExcelRow): string {
  // Trimmed for the same reason as groupRowsByColumn's own key - an
  // untrimmed source value would split one real group into several.
  return columns.map((column) => String(row[column] ?? "").trim()).join(GROUP_KEY_SEPARATOR);
}

/** Same stable-order grouping as groupRowsByColumn, but keyed on the
 *  combination of several columns' values instead of just one. */
export function groupRowsByColumns(dataRows: ParsedExcelRow[], columns: string[]): ParsedExcelRow[][] {
  const order: string[] = [];
  const buckets = new Map<string, ParsedExcelRow[]>();
  for (const row of dataRows) {
    const key = computeGroupKey(columns, row);
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
 * - `groupByColumns` (or the older single-column `groupByColumn`), when
 *   given, splits the data into groups (stable order of first appearance)
 *   and repeats both the letterhead (before the table) *and* whatever the
 *   template author put after the table (a signature/approval block,
 *   typically) once per group, with a real page break between one group's
 *   section and the next. Only the document's own final closing structure
 *   (the body-level `<w:sectPr>` plus `</w:body></w:document>`) is kept to
 *   a single copy, at the true end.
 * - `fitGroupToOnePage`, when true, shrinks a group's own header+data row
 *   heights and font sizes (never below a legibility floor) when that
 *   group's row count would otherwise overflow one printed page - a
 *   heuristic estimate, not a guaranteed fit for every group size.
 */
export async function fillDocxTemplate(
  templateBuffer: ArrayBuffer,
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[],
  options?: { groupByColumn?: string; groupByColumns?: string[]; autoNumberHeader?: string; fitGroupToOnePage?: boolean }
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

  // Whatever the template author put *after* the table - a signature/
  // approval block is the common case - is exactly as "per group" as the
  // letterhead before it: a real attendance/grades sheet needs its own
  // sign-off under every group's own table, not just once at the very
  // bottom of the whole document. The one thing that must still appear
  // exactly once, at the true end, is the body's own closing <w:sectPr>
  // (page size/margins/header-footer references - a direct child of
  // <w:body>, not a paragraph's own section-break sectPr) plus
  // </w:body></w:document> themselves, so the split happens right there.
  const afterTable = xml.slice(tableEnd);
  const sectPrIndex = afterTable.lastIndexOf("<w:sectPr");
  const repeatableTrailingXml = sectPrIndex === -1 ? "" : afterTable.slice(0, sectPrIndex);
  const documentCloseXml = sectPrIndex === -1 ? afterTable : afterTable.slice(sectPrIndex);

  const rowMatches = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
  if (rowMatches.length === 0) throw new Error("لم يتم العثور على صفوف في جدول القالب");

  const headerRowXml: string = rowMatches[0]!;
  const styleRowXml: string = rowMatches.length > 1 ? rowMatches[rowMatches.length - 1]! : headerRowXml;
  const styleCells = styleRowXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
  const rowOpenTag = styleRowXml.match(/^<w:tr[^>]*>/)?.[0] ?? "<w:tr>";
  const tableOpenPart = tableXml.slice(0, tableXml.indexOf(headerRowXml));

  // Some real templates leave one column (typically a serial-number "م"
  // column) with no explicit <w:sz>/<w:szCs> on its run at all, while every
  // other column in the same row sets one explicitly - that column then
  // renders at Word's own document-default size instead of the size the
  // template author actually chose for the table, which both looks
  // mismatched against the rest of the row AND, since a table row's real
  // height is set by its TALLEST cell, leaves that smaller-font cell
  // visibly floating in empty space inside a row sized for the bigger text.
  // Every generated cell (and the header row) gets normalized to match
  // whatever size most of the table's own cells already agree on, rather
  // than leaving whichever column the template happened to under-specify
  // stuck at a mismatched default.
  function computeDominantFontSize(cells: string[]): { sz: number; szCs: number } {
    const count = (attr: "w:sz" | "w:szCs") => {
      const tally = new Map<number, number>();
      for (const cell of cells) {
        const regex = new RegExp(`<${attr}\\b[^>]*w:val="(\\d+)"`, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(cell)) !== null) {
          const val = Number(match[1]);
          tally.set(val, (tally.get(val) ?? 0) + 1);
        }
      }
      let best = 24; // 12pt fallback if the template sets no size anywhere
      let bestCount = 0;
      for (const [val, n] of tally) {
        if (n > bestCount) {
          best = val;
          bestCount = n;
        }
      }
      return best;
    };
    return { sz: count("w:sz"), szCs: count("w:szCs") };
  }

  const { sz: dominantSz, szCs: dominantSzCs } = computeDominantFontSize(styleCells);

  /** Only touches a cell that has no explicit size anywhere in it - a cell
   *  that already declares one (the common case) is left completely alone. */
  function ensureFontSize(cellXml: string): string {
    if (/<w:sz\b/.test(cellXml)) return cellXml;
    return cellXml.replace(/<w:rPr>/g, `<w:rPr><w:sz w:val="${dominantSz}"/><w:szCs w:val="${dominantSzCs}"/>`);
  }

  /** Same normalization, applied cell-by-cell to a whole row - needed
   *  because checking/replacing across the *entire* row at once would find
   *  some OTHER cell's <w:sz> and wrongly skip the one cell that actually
   *  needs it. Used for the header row, which can have the same
   *  missing-size column as the data rows. */
  function normalizeRowFontSize(rowXml: string): string {
    return rowXml.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cellXml) => ensureFontSize(cellXml));
  }

  function buildRow(values: (string | number)[], scale: number): string {
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
        return ensureFontSize(withValue.replace(/<\/w:tc>$/, `<w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`));
      }
      return ensureFontSize(withValue);
    });
    return scaleRowXml(`${rowOpenTag}${cellsXml.join("")}</w:tr>`, scale);
  }

  // fitGroupToOnePage: a heuristic, not a guarantee. Word has no real
  // "shrink to fit" for a table the way Excel's print scaling does, and
  // nothing in the OOXML gives an exact rendered line height without an
  // actual layout engine - this estimates the letterhead/trailing block's
  // height as one fixed line per paragraph, which is close enough to decide
  // *whether* a group needs shrinking and by roughly how much, not to
  // guarantee pixel-perfect single-page output for every possible group
  // size. Extremely large groups still get the floor scale rather than
  // becoming illegible, and may still spill onto a second page - a
  // deliberate tradeoff over unreadable text.
  const FIT_MIN_SCALE = 0.55;
  const FIT_MIN_FONT_HALF_POINTS = 16; // 8pt - never scale text smaller than this
  const FIT_ASSUMED_LINE_HEIGHT_TWIPS = 320; // ~16pt line, a reasonable single-spaced default

  function extractAttr(fromXml: string, tagName: string, attrName: string): number | null {
    const tag = fromXml.match(new RegExp(`<${tagName}\\b[^>]*/?>`));
    if (!tag) return null;
    const attr = tag[0].match(new RegExp(`${attrName}="(-?\\d+)"`));
    return attr ? Number(attr[1]) : null;
  }

  function scaleRowXml(rowXml: string, scale: number): string {
    if (scale >= 1) return rowXml;
    return rowXml
      .replace(/(<w:trHeight\b[^>]*w:val=")(\d+)(")/g, (_m, pre: string, val: string, post: string) =>
        `${pre}${Math.round(Number(val) * scale)}${post}`
      )
      .replace(/(<w:sz(Cs)?\b[^>]*w:val=")(\d+)(")/g, (_m, pre: string, _cs: string, val: string, post: string) =>
        `${pre}${Math.max(FIT_MIN_FONT_HALF_POINTS, Math.round(Number(val) * scale))}${post}`
      );
  }

  function countParagraphs(fromXml: string): number {
    return (fromXml.match(/<w:p[ >]/g) ?? []).length;
  }

  /** How much to shrink one group's header+data rows so its own row count
   *  is more likely to fit the page - each group gets its own scale since
   *  group sizes can vary widely in one document. */
  function computeGroupScale(rowCount: number): number {
    if (!options?.fitGroupToOnePage || rowCount === 0) return 1;

    const pageHeight = extractAttr(documentCloseXml, "w:pgSz", "w:h") ?? 15840; // US Letter default
    const marginTop = extractAttr(documentCloseXml, "w:pgMar", "w:top") ?? 1440;
    const marginBottom = extractAttr(documentCloseXml, "w:pgMar", "w:bottom") ?? 1440;
    const usableHeight = pageHeight - marginTop - marginBottom;

    const headerRowHeight = extractAttr(headerRowXml, "w:trHeight", "w:val") ?? 400;
    const dataRowHeight = extractAttr(styleRowXml, "w:trHeight", "w:val") ?? 400;
    const fixedOverhead =
      (countParagraphs(letterheadXml) + countParagraphs(repeatableTrailingXml)) * FIT_ASSUMED_LINE_HEIGHT_TWIPS +
      headerRowHeight;

    const availableForData = usableHeight - fixedOverhead;
    const maxFullSizeRows = Math.max(1, Math.floor(availableForData / dataRowHeight));
    if (rowCount <= maxFullSizeRows) return 1;
    return Math.max(FIT_MIN_SCALE, maxFullSizeRows / rowCount);
  }

  // groupByColumns (a combination of several columns, e.g. track + group
  // together) takes priority when given - same reasoning as
  // fillXlsxTemplate's own groupByColumns: a single groupByColumn would
  // mix rows that only share one of the two, splitting "track A / group 1"
  // and "track B / group 1" into the same section even though they're
  // unrelated.
  const groups = options?.groupByColumns?.length
    ? groupRowsByColumns(dataRows, options.groupByColumns)
    : options?.groupByColumn
      ? groupRowsByColumn(dataRows, options.groupByColumn)
      : [dataRows];

  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  const sections = groups
    .map((groupRows, index) => {
      // Numbering restarts at 1 for each group (or once, if ungrouped) -
      // matches "كل مجموعة ترقيم جديد" rather than a single running count
      // across the whole document.
      const scale = computeGroupScale(groupRows.length);
      let counter = 1;
      const generatedRows = groupRows
        .map((row) => buildRowValues(templateHeaders, mapping, row, options?.autoNumberHeader, counter++))
        .map((values) => buildRow(values, scale))
        .join("");
      const sectionLetterhead = substitutePlaceholders(letterheadXml, rowToPlaceholderValues(groupRows[0]));
      const sectionTable = `${tableOpenPart}${scaleRowXml(normalizeRowFontSize(headerRowXml), scale)}${generatedRows}</w:tbl>`;
      const sectionTrailing = substitutePlaceholders(repeatableTrailingXml, rowToPlaceholderValues(groupRows[0]));
      // Every group after the first starts on its own fresh page - only the
      // very first section is already at the top of page 1 by definition.
      const pageBreak = index > 0 ? PAGE_BREAK : "";
      return `${pageBreak}${sectionLetterhead}${sectionTable}${sectionTrailing}`;
    })
    .join("");

  const newXml = `${documentOpenXml}${sections}${documentCloseXml}`;

  zip.file(documentPath, newXml);
  return zip.generateAsync({ type: "nodebuffer" });
}
