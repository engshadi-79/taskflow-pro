import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import {
  fillXlsxTemplate,
  fillDocxTemplate,
  isDocxFile,
  type ParsedExcelRow,
} from "@/lib/reports/template-file-utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

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
  const templateFile = formData.get("templateFile") as File | null;
  const outputFormat = formData.get("outputFormat") as "xlsx" | "docx" | null;
  const templateHeaders = JSON.parse((formData.get("templateHeaders") as string) || "[]") as string[];
  const mapping = JSON.parse((formData.get("mapping") as string) || "{}") as Record<string, string>;
  const dataRows = JSON.parse((formData.get("dataRows") as string) || "[]") as ParsedExcelRow[];

  if (!Array.isArray(templateHeaders) || templateHeaders.length === 0 || !outputFormat) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  if (templateFile && templateFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "حجم ملف القالب أكبر من الحد المسموح" }, { status: 400 });
  }

  try {
    const templateIsDocx = templateFile ? isDocxFile(templateFile) : false;
    const sameFormat = templateFile != null && ((outputFormat === "docx") === templateIsDocx);

    if (outputFormat === "docx") {
      const buffer = sameFormat
        ? await fillDocxTemplate(await templateFile!.arrayBuffer(), templateHeaders, mapping, dataRows)
        : await buildBareDocx(templateHeaders, mapping, dataRows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="converted.docx"',
        },
      });
    }

    const buffer = sameFormat
      ? await fillXlsxTemplate(await templateFile!.arrayBuffer(), templateHeaders, mapping, dataRows)
      : await buildBareXlsx(templateHeaders, mapping, dataRows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="converted.xlsx"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "تعذر توليد الملف" },
      { status: 500 }
    );
  }
}
