import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";

type ConvertRequestBody = {
  templateHeaders: string[];
  mapping: Record<string, string>;
  dataRows: Record<string, string | number | null>[];
  outputFormat: "xlsx" | "docx";
};

function mappedRow(
  header: string,
  mapping: Record<string, string>,
  row: Record<string, string | number | null>
): string {
  const sourceKey = mapping?.[header];
  if (!sourceKey) return "";
  const value = row[sourceKey];
  return value == null ? "" : String(value);
}

async function buildXlsx(
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: Record<string, string | number | null>[]
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

async function buildDocx(
  templateHeaders: string[],
  mapping: Record<string, string>,
  dataRows: Record<string, string | number | null>[]
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

/** Same auth shape as /api/reports/export - builds the output from already-
 *  parsed rows (see parseTemplateAndDataFiles in template-converter.ts) and
 *  streams it back as a download. Nothing here touches Storage or a table. */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = (await request.json()) as ConvertRequestBody;
  const { templateHeaders, mapping, dataRows, outputFormat } = body;

  if (!Array.isArray(templateHeaders) || templateHeaders.length === 0) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if (outputFormat === "docx") {
    const buffer = await buildDocx(templateHeaders, mapping ?? {}, dataRows ?? []);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="converted.docx"',
      },
    });
  }

  const buffer = await buildXlsx(templateHeaders, mapping ?? {}, dataRows ?? []);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="converted.xlsx"',
    },
  });
}
