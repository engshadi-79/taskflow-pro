"use server";

import ExcelJS from "exceljs";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import {
  extractSheetData,
  extractHeadersFromDocxTable,
  suggestColumnMapping,
  isDocxFile,
  type ParsedExcelRow,
} from "@/lib/reports/template-file-utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type { ParsedExcelRow };

export type ParseTemplateResult =
  | { error: string }
  | {
      templateHeaders: string[];
      dataHeaders: string[];
      dataRows: ParsedExcelRow[];
      suggestedMapping: Record<string, string>;
      truncated: boolean;
    };

/**
 * Stateless by design: both files are parsed in this one request and never
 * written to Storage or a table - the browser holds the parsed rows/mapping
 * (and the original template file) between this call and the generate step
 * (see template-converter.tsx and /api/reports/convert-template). Gated
 * behind reports.build, the same permission the custom Report Builder
 * already uses. The template file may be .xlsx (first sheet's header row)
 * or .docx (first table's header row); the data file is always .xlsx.
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
      truncated: dataRows.length >= 5000,
    };
  } catch {
    return { error: "تعذر قراءة أحد الملفين - تأكد أن القالب Excel أو Word صحيح وأن ملف البيانات بصيغة Excel (.xlsx)" };
  }
}
