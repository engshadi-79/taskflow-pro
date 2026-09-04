"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { extractSheetData, extractHeadersFromDocxTable, isDocxFile } from "@/lib/reports/template-file-utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BUCKET = "report-templates";

export type SavedTemplateRow = {
  id: string;
  name: string;
  file_format: "xlsx" | "docx";
  template_headers: string[];
  created_at: string;
  default_group_by_columns: string[] | null;
};

export type SaveTemplateResult = { error?: string; id?: string };

/**
 * Uploads the template file itself to the private report-templates bucket
 * (path "<organization_id>/<template_id>.<ext>", see
 * report_templates_library.sql) and caches its extracted header list on the
 * row, so reusing a saved template later doesn't need to re-download and
 * re-parse the file just to populate the mapping step.
 */
export async function saveTemplate(formData: FormData): Promise<SaveTemplateResult> {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return { error: "غير مصرح لك بحفظ القوالب" };
  }

  const file = formData.get("templateFile") as File | null;
  const name = (formData.get("name") as string)?.trim();

  if (!file) return { error: "اختر ملف القالب أولًا" };
  if (!name) return { error: "اسم القالب مطلوب" };
  if (file.size > MAX_FILE_BYTES) return { error: "الحد الأقصى لحجم الملف 5 ميجابايت" };

  const format: "xlsx" | "docx" = isDocxFile(file) ? "docx" : "xlsx";

  try {
    const buffer = await file.arrayBuffer();

    let headers: string[];
    if (format === "docx") {
      headers = await extractHeadersFromDocxTable(buffer);
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return { error: "لم يتم العثور على أي ورقة في الملف" };
      headers = extractSheetData(sheet).headers;
    }
    if (headers.length === 0) return { error: "تعذر العثور على صف عناوين في هذا الملف" };

    const supabase = await createClient();
    const templateId = crypto.randomUUID();
    const path = `${profile.organization_id}/${templateId}.${format}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType:
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (uploadError) return { error: "تعذر رفع ملف القالب" };

    const { error: insertError } = await supabase.from("saved_templates").insert({
      id: templateId,
      organization_id: profile.organization_id,
      created_by: profile.id,
      name,
      file_path: path,
      file_format: format,
      template_headers: headers,
    });
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return { error: "تعذر حفظ بيانات القالب" };
    }

    revalidatePath("/dashboard/reports/converter");
    return { id: templateId };
  } catch {
    return { error: "تعذر قراءة الملف - تأكد أنه بصيغة Excel أو Word صحيحة" };
  }
}

export async function listSavedTemplates(): Promise<SavedTemplateRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_templates")
    .select("id, name, file_format, template_headers, created_at, default_group_by_columns")
    .order("created_at", { ascending: false });

  return (data ?? []) as SavedTemplateRow[];
}

/** Remembers which raw data-file column(s) this template is normally
 *  grouped by (e.g. "المسار"/"المجموعة" for an attendance sheet), so
 *  selecting it again pre-fills the converter's own grouping dropdowns
 *  instead of the user re-picking the same columns on every conversion. An
 *  empty array clears the default back to "no grouping". */
export async function setDefaultGroupByColumns(id: string, columns: string[]): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_templates")
    .update({ default_group_by_columns: columns.length > 0 ? columns : null })
    .eq("id", id);
  if (error) return { error: "تعذر حفظ الإعداد الافتراضي" };

  revalidatePath("/dashboard/reports/converter");
  return {};
}

export type FetchSavedTemplateResult =
  | { error: string }
  | { buffer: ArrayBuffer; format: "xlsx" | "docx"; headers: string[]; name: string };

/** Downloads a saved template's actual file bytes for reuse - by
 *  parseTemplateAndDataFiles() (to populate the mapping step without asking
 *  for a re-upload) and by the /api/reports/convert-template route (to fill
 *  it in place at generation time). RLS on both the table and the storage
 *  bucket already scope this to the caller's own organization. */
export async function fetchSavedTemplateFile(id: string): Promise<FetchSavedTemplateResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: row, error: rowError } = await supabase
    .from("saved_templates")
    .select("file_path, file_format, template_headers, name")
    .eq("id", id)
    .maybeSingle();

  if (rowError || !row) return { error: "القالب غير موجود" };

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (downloadError || !blob) return { error: "تعذر تحميل ملف القالب" };

  return {
    buffer: await blob.arrayBuffer(),
    format: row.file_format as "xlsx" | "docx",
    headers: row.template_headers as string[],
    name: row.name,
  };
}

export async function deleteSavedTemplate(id: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { data: row } = await supabase.from("saved_templates").select("file_path").eq("id", id).maybeSingle();

  const { error } = await supabase.from("saved_templates").delete().eq("id", id);
  if (error) return { error: "تعذر حذف القالب" };

  if (row?.file_path) {
    await supabase.storage.from(BUCKET).remove([row.file_path]);
  }

  revalidatePath("/dashboard/reports/converter");
  return {};
}
