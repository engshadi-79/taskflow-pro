import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { fetchSavedTemplateFile } from "@/lib/actions/saved-templates";
import {
  fillXlsxTemplate,
  fillDocxTemplate,
  isDocxFile,
  formatMonthYearArabic,
  type ParsedExcelRow,
} from "@/lib/reports/template-file-utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Arabic filenames need the RFC 5987 filename* form - a plain ASCII
 *  `filename="..."` either mangles non-ASCII characters or gets rejected
 *  outright depending on the browser, so both forms are sent together: a
 *  safe ASCII fallback for anything that only reads the legacy param, and
 *  the real UTF-8 name (percent-encoded per the RFC) for everything else. */
function contentDisposition(name: string, extension: string): string {
  const fallback = `converted.${extension}`;
  const encoded = encodeURIComponent(`${name}.${extension}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function mappedRow(header: string, mapping: Record<string, string>, row: ParsedExcelRow): string {
  const sourceKey = mapping?.[header];
  if (!sourceKey) return "";
  const value = row[sourceKey];
  return value == null ? "" : String(value);
}

/** No template to preserve formatting from (either none was resent, or its
 *  format doesn't match the requested output) - builds a bare workbook with
 *  just the header row and mapped values, same as the tool's first version. */
async function buildBareXlsx(
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("البيانات المحوّلة");
  sheet.addRow(templateHeaders);
  for (const row of dataRows) {
    sheet.addRow(templateHeaders.map((header) => mappedRow(header, mapping, row)));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function textCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun(text)] })] });
}

async function buildBareDocx(
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: ParsedExcelRow[]
): Promise<Buffer> {
  const rows = [
    new TableRow({ children: templateHeaders.map(textCell) }),
    ...dataRows.map(
      (row) => new TableRow({ children: templateHeaders.map((header) => textCell(mappedRow(header, mapping, row))) })
    ),
  ];
  const doc = new Document({ sections: [{ children: [new Table({ rows })] }] });
  return Packer.toBuffer(doc);
}

/**
 * Same auth shape as /api/reports/export. Accepts multipart form data (not
 * JSON) because the original template file itself is resent here - the
 * whole point of this endpoint's format-preserving path is loading the real
 * uploaded file and injecting rows into it, so its letterhead/logo/column
 * widths/existing styling survive untouched, instead of rebuilding a bare
 * document from scratch. That fill-in-place path only applies when the
 * requested output format matches the template's own format (xlsx->xlsx or
 * docx->docx); a cross-format request (e.g. an Excel template but a Word
 * output) has no compatible styling to carry over, so it falls back to the
 * original bare-generation path.
 */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const formData = await request.formData();
  const savedTemplateId = formData.get("savedTemplateId") as string | null;
  const templateFile = formData.get("templateFile") as File | null;
  const outputFormat = formData.get("outputFormat") as "xlsx" | "docx" | null;
  const templateHeaders = JSON.parse((formData.get("templateHeaders") as string) || "[]") as string[];
  const mapping = JSON.parse((formData.get("mapping") as string) || "{}") as Record<string, string>;
  const dataRows = JSON.parse((formData.get("dataRows") as string) || "[]") as ParsedExcelRow[];
  // Grouped by a raw data-file column directly, not a template column - a
  // template's group title (e.g. "{{المسار}} - {{المجموعة}}") is often only
  // a placeholder in a banner row, not an actual mapped table column, so
  // there may be no template header to route the grouping key through. Both
  // formats accept a combination of columns (e.g. track + group together)
  // via groupByColumns - groupByColumn (singular) is kept only as a fallback
  // for any older caller still sending just one.
  const groupByColumn = (formData.get("groupByDataHeader") as string | null) || undefined;
  const groupByColumnsRaw = formData.get("groupByColumns") as string | null;
  const groupByColumns = groupByColumnsRaw ? (JSON.parse(groupByColumnsRaw) as string[]) : undefined;
  const autoNumberHeader = (formData.get("autoNumberHeader") as string | null) || undefined;
  const sortRowsBy = (formData.get("sortRowsBy") as string | null) || undefined;
  const fitGroupToOnePage = formData.get("fitGroupToOnePage") === "1";

  const sessionDatesStartDate = formData.get("sessionDatesStartDate") as string | null;
  const sessionDatesEndDate = formData.get("sessionDatesEndDate") as string | null;
  const sessionDatesWeekdays = formData.get("sessionDatesWeekdays") as string | null;
  const sessionDatesWeekdaysByGroup = formData.get("sessionDatesWeekdaysByGroup") as string | null;
  const sessionDates =
    sessionDatesStartDate && sessionDatesEndDate
      ? {
          startDate: sessionDatesStartDate,
          endDate: sessionDatesEndDate,
          weekdays: sessionDatesWeekdays ? (JSON.parse(sessionDatesWeekdays) as number[]) : undefined,
          weekdaysByGroup: sessionDatesWeekdaysByGroup
            ? (JSON.parse(sessionDatesWeekdaysByGroup) as Record<string, number[]>)
            : undefined,
        }
      : undefined;

  if (!Array.isArray(templateHeaders) || templateHeaders.length === 0 || !outputFormat) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  if (templateFile && templateFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "حجم ملف القالب أكبر من الحد المسموح" }, { status: 400 });
  }

  try {
    // Resolve the real template bytes + format from whichever source the
    // client used (a fresh upload or a saved-template id) before deciding
    // whether the fill-in-place path applies.
    let templateBuffer: ArrayBuffer | null = null;
    let templateIsDocx = false;
    // A saved template's own name (e.g. "كشف حضور وغياب الامن") names the
    // download too, instead of the generic "converted.xlsx" - falls back to
    // the uploaded file's own name (minus its extension) when there's no
    // saved template to name it after.
    let outputName = "converted";

    if (savedTemplateId) {
      const saved = await fetchSavedTemplateFile(savedTemplateId);
      if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
      templateBuffer = saved.buffer;
      templateIsDocx = saved.format === "docx";
      outputName = saved.name;
    } else if (templateFile) {
      templateBuffer = await templateFile.arrayBuffer();
      templateIsDocx = isDocxFile(templateFile);
      outputName = templateFile.name.replace(/\.[^.]+$/, "") || outputName;
    }
    if (sessionDates) {
      outputName = `${outputName} - ${formatMonthYearArabic(sessionDates.startDate)}`;
    }

    const sameFormat = templateBuffer != null && (outputFormat === "docx") === templateIsDocx;

    if (outputFormat === "docx") {
      const buffer = sameFormat
        ? await fillDocxTemplate(templateBuffer!, templateHeaders, mapping, dataRows, { groupByColumn, groupByColumns, autoNumberHeader, fitGroupToOnePage })
        : await buildBareDocx(templateHeaders, mapping, dataRows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": contentDisposition(outputName, "docx"),
        },
      });
    }

    const buffer = sameFormat
      ? await fillXlsxTemplate(templateBuffer!, templateHeaders, mapping, dataRows, { groupByColumns, autoNumberHeader, sortRowsBy, sessionDates })
      : await buildBareXlsx(templateHeaders, mapping, dataRows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(outputName, "xlsx"),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "تعذر توليد الملف" },
      { status: 500 }
    );
  }
}
