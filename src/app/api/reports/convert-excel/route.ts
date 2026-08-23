import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";

type ConvertRequestBody = {
  templateHeaders: string[];
  mapping: Record<string, string>;
  dataRows: Record<string, string | number | null>[];
};

/** Same auth/response shape as /api/reports/export - builds one workbook
 *  from already-parsed rows (see parseExcelFiles in excel-converter.ts) and
 *  streams it back as a download. Nothing here touches Storage or a table. */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = (await request.json()) as ConvertRequestBody;
  const { templateHeaders, mapping, dataRows } = body;

  if (!Array.isArray(templateHeaders) || templateHeaders.length === 0) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("البيانات المحوّلة");
  sheet.addRow(templateHeaders);

  for (const row of dataRows ?? []) {
    sheet.addRow(
      templateHeaders.map((header) => {
        const sourceKey = mapping?.[header];
        if (!sourceKey) return "";
        return row[sourceKey] ?? "";
      })
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="converted.xlsx"',
    },
  });
}
