"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/guards";
import { generateApiKey } from "@/lib/api-keys";

export type DeveloperState = { error?: string; plaintext?: string; secret?: string };

export async function createApiKey(
  _prevState: DeveloperState,
  formData: FormData
): Promise<DeveloperState> {
  const profile = await requireRole(["super_admin"]);
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "اسم المفتاح مطلوب" };

  const { plaintext, prefix, hash } = generateApiKey();

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    organization_id: profile.organization_id,
    name,
    key_prefix: prefix,
    key_hash: hash,
    created_by: profile.id,
  });

  if (error) return { error: "تعذر إنشاء المفتاح" };

  revalidatePath("/dashboard/settings/developer");
  // Shown exactly once - only the hash is stored, so this is the caller's
  // only chance to see the real key.
  return { plaintext };
}

export async function revokeApiKey(id: string): Promise<DeveloperState> {
  const profile = await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) return { error: "تعذر إلغاء المفتاح" };
  revalidatePath("/dashboard/settings/developer");
  return {};
}

const VALID_EVENTS = ["task.created", "task.status_changed", "task.completed"];
const VALID_KINDS = ["generic", "slack", "teams"];

export async function createWebhookEndpoint(
  _prevState: DeveloperState,
  formData: FormData
): Promise<DeveloperState> {
  const profile = await requireRole(["super_admin"]);
  const url = (formData.get("url") as string)?.trim();
  const events = formData.getAll("events").map(String).filter((e) => VALID_EVENTS.includes(e));
  const kindInput = formData.get("kind") as string;
  const kind = VALID_KINDS.includes(kindInput) ? kindInput : "generic";

  if (!url || !/^https:\/\//.test(url)) {
    return { error: "رابط الوجهة يجب أن يبدأ بـ https://" };
  }
  if (events.length === 0) {
    return { error: "اختر حدثًا واحدًا على الأقل" };
  }

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

  const supabase = await createClient();
  const { error } = await supabase.from("webhook_endpoints").insert({
    organization_id: profile.organization_id,
    url,
    secret,
    events,
    kind,
    created_by: profile.id,
  });

  if (error) return { error: "تعذر إضافة الوجهة" };

  revalidatePath("/dashboard/settings/developer");
  return { secret };
}

export async function toggleWebhookEndpoint(id: string, isActive: boolean): Promise<DeveloperState> {
  const profile = await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("webhook_endpoints")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) return { error: "تعذر تحديث الوجهة" };
  revalidatePath("/dashboard/settings/developer");
  return {};
}

export async function deleteWebhookEndpoint(id: string): Promise<DeveloperState> {
  const profile = await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) return { error: "تعذر حذف الوجهة" };
  revalidatePath("/dashboard/settings/developer");
  return {};
}
