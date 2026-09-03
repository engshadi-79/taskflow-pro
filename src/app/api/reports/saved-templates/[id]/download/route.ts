import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import { fetchSavedTemplateFile } from "@/lib/actions/saved-templates";
import { contentDispositionHeader } from "@/lib/reports/template-file-utils";

/**
 * Lets a saved template's own original file be downloaded back out, next to
 * the existing "استخدام"/"حذف" actions on the converter page - the only way
 * to get a saved template's real bytes back today is regenerating an output
 * with it, which isn't the same file. fetchSavedTemplateFile() is already
 * used by both the parse and convert-template routes and is already
 * org-scoped through the plain RLS-scoped client it uses internally, so this
 * route only adds the same permission check every other reports.build
 * endpoint already uses, then reuses it as-is rather than re-querying
 * storage directly.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;
  const saved = await fetchSavedTemplateFile(id);
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 404 });

  const contentType =
    saved.format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new NextResponse(new Uint8Array(saved.buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDispositionHeader(saved.name, saved.format),
    },
  });
}
