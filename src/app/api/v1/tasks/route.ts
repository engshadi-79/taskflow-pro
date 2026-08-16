import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, parseBearerApiKey } from "@/lib/api-keys";
import { enforceRateLimit } from "@/lib/foundation/rate-limit";
import { emit } from "@/lib/foundation/events";
// Side-effect import: registers the webhook dispatcher, same reason as in
// src/lib/actions/tasks.ts - this route also emits "task.created".
import "@/lib/webhooks/dispatcher";

export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_MINUTE = 60;

/**
 * Resolves an `Authorization: Bearer sk_live_...` header to the issuing
 * organization - the API-key equivalent of a Supabase session, since an
 * external caller has no auth.uid()/RLS context at all. Uses the
 * service-role client throughout (same pattern as the P15 cron routes):
 * every query below manually filters by organizationId instead of relying
 * on RLS, which would reject everything for a sessionless caller anyway.
 */
async function resolveApiKey(req: NextRequest) {
  const key = parseBearerApiKey(req.headers.get("authorization"));
  if (!key) return null;

  const supabase = createAdminClient();
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, organization_id, created_by, revoked_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (!keyRow || keyRow.revoked_at) return null;

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  return { supabase, organizationId: keyRow.organization_id as string, keyId: keyRow.id as string, createdBy: keyRow.created_by as string };
}

async function checkRateLimit(supabase: ReturnType<typeof createAdminClient>, keyId: string, organizationId: string) {
  try {
    await enforceRateLimit(supabase, {
      bucketKey: `api_key:${keyId}`,
      organizationId,
      userId: null,
      limit: RATE_LIMIT_PER_MINUTE,
      windowSeconds: 60,
      message: `تجاوزت الحد المسموح (${RATE_LIMIT_PER_MINUTE} طلبًا في الدقيقة)`,
    });
    return null;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تجاوزت الحد المسموح" }, { status: 429 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await resolveApiKey(req);
  if (!auth) return NextResponse.json({ error: "مفتاح API غير صالح" }, { status: 401 });

  const limited = await checkRateLimit(auth.supabase, auth.keyId, auth.organizationId);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  let query = auth.supabase
    .from("tasks")
    .select("id, title, description, status, priority, assigned_to, due_date, created_at")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "تعذر جلب المهام" }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await resolveApiKey(req);
  if (!auth) return NextResponse.json({ error: "مفتاح API غير صالح" }, { status: 401 });

  const limited = await checkRateLimit(auth.supabase, auth.keyId, auth.organizationId);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title مطلوب" }, { status: 400 });
  }
  if (!body?.assigned_to || typeof body.assigned_to !== "string") {
    return NextResponse.json({ error: "assigned_to مطلوب" }, { status: 400 });
  }

  const { data: assignee } = await auth.supabase
    .from("users")
    .select("id")
    .eq("id", body.assigned_to)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (!assignee) {
    return NextResponse.json({ error: "assigned_to لا ينتمي لهذه المؤسسة" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      organization_id: auth.organizationId,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : null,
      assigned_to: body.assigned_to,
      created_by: auth.createdBy,
      priority: ["low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium",
      status: "new",
      due_date: typeof body.due_date === "string" ? body.due_date : null,
    })
    .select("id")
    .single();

  if (error || !data) return NextResponse.json({ error: "تعذر إنشاء المهمة" }, { status: 500 });

  after(() =>
    emit("task.created", {
      organizationId: auth.organizationId,
      taskId: data.id,
      title: body.title.trim(),
      assignedTo: body.assigned_to,
      createdBy: auth.createdBy,
    })
  );

  return NextResponse.json({ data: { id: data.id } }, { status: 201 });
}
