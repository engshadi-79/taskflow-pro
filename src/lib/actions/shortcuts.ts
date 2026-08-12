"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { AVAILABLE_PAGES, ICON_REGISTRY, MAX_SHORTCUTS, type IconKey, type ShortcutItem } from "@/lib/shortcuts-registry";

const KNOWN_HREFS = new Set(AVAILABLE_PAGES.map((p) => p.href));
const KNOWN_ICON_KEYS = new Set(Object.keys(ICON_REGISTRY));

export type ShortcutsState = { error?: string };

function isSafeExternalUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function updateOwnShortcuts(items: ShortcutItem[]): Promise<ShortcutsState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  if (items.length > MAX_SHORTCUTS) {
    return { error: `الحد الأقصى ${MAX_SHORTCUTS} اختصارات` };
  }

  const cleaned: ShortcutItem[] = [];
  for (const item of items) {
    const label = item.label?.trim().slice(0, 40);
    if (!label) return { error: "لكل اختصار عنوان" };

    const isKnownPage = KNOWN_HREFS.has(item.href);
    if (!isKnownPage && !isSafeExternalUrl(item.href)) {
      return { error: "رابط غير صالح" };
    }

    const iconKey: IconKey = KNOWN_ICON_KEYS.has(item.iconKey) ? item.iconKey : "external";
    cleaned.push({ id: item.id, href: item.href, label, iconKey });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_dashboard_shortcuts", { p_shortcuts: cleaned });
  if (error) return { error: "تعذر حفظ الاختصارات" };

  revalidatePath("/dashboard", "layout");
  return {};
}
