import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { getProfileFromBearerToken, parseBearerToken } from "@/lib/supabase/mobile-auth";
import { runAssistant, AiProviderRateLimitError } from "@/lib/ai/assistant";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;
const RATE_LIMIT_PER_MINUTE = 8;
const RATE_LIMIT_PER_DAY = 80;

type HistoryTurn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  // Web dashboard: cookie session (getCurrentProfile). Mobile app: no
  // cookie jar, so it sends its own Supabase access token as a bearer
  // header instead - same user, same RLS scoping, just a different way of
  // proving it. Cookie path stays untouched for the existing web caller.
  const cookieProfile = await getCurrentProfile();
  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  const authResult = cookieProfile
    ? { supabase: await createClient(), profile: cookieProfile }
    : bearerToken
      ? await getProfileFromBearerToken(bearerToken)
      : null;

  if (!authResult) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }
  const { supabase, profile } = authResult;

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "الرسالة طويلة جدًا" }, { status: 400 });
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history: HistoryTurn[] = rawHistory
    .filter(
      (h): h is HistoryTurn =>
        !!h &&
        typeof h === "object" &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.content === "string"
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_MESSAGE_LENGTH) }));

  const since1min = new Date(Date.now() - 60_000).toISOString();
  const since1day = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: minuteCount }, { count: dayCount }] = await Promise.all([
    supabase
      .from("ai_interactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .gte("created_at", since1min),
    supabase
      .from("ai_interactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .gte("created_at", since1day),
  ]);

  if ((minuteCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json(
      { error: "لقد تجاوزت الحد المسموح من الطلبات، حاول بعد دقيقة." },
      { status: 429 }
    );
  }
  if ((dayCount ?? 0) >= RATE_LIMIT_PER_DAY) {
    return NextResponse.json(
      { error: "لقد تجاوزت الحد اليومي لاستخدام المساعد الذكي." },
      { status: 429 }
    );
  }

  let result;
  try {
    result = await runAssistant({ supabase, profile }, history, message);
  } catch (err) {
    if (err instanceof AiProviderRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("AI assistant error", err);
    return NextResponse.json({ error: "تعذر الوصول إلى المساعد الذكي، حاول مرة أخرى." }, { status: 502 });
  }

  const { data: interaction, error: interactionError } = await supabase
    .from("ai_interactions")
    .insert({
      organization_id: profile.organization_id,
      user_id: profile.id,
      prompt: message,
      response: result.text,
      tool_calls: result.toolCalls,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    return NextResponse.json({ error: "تعذر تسجيل التفاعل" }, { status: 500 });
  }

  const suggestions = [];
  for (const draft of result.suggestionDrafts) {
    const { data: row } = await supabase
      .from("ai_suggested_actions")
      .insert({
        interaction_id: interaction.id,
        organization_id: profile.organization_id,
        created_by: profile.id,
        action_type: draft.action_type,
        target_type: draft.target_type,
        target_id: draft.target_id,
        summary: draft.summary,
        payload: draft.payload,
      })
      .select("id, action_type, summary, target_id, status")
      .single();
    if (row) suggestions.push(row);
  }

  return NextResponse.json({ reply: result.text, suggestions });
}
