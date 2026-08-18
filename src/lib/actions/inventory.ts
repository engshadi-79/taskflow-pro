"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { requireRole } from "@/lib/actions/guards";

export type InventoryFormState = { error?: string };

export async function assignTrackResponsible(trackId: string, userId: string | null) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_tracks")
    .update({ responsible_user_id: userId })
    .eq("id", trackId);

  if (error) return { error: "تعذر إسناد المسار" };

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function createInventoryTool(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const profile = await requireRole(["super_admin"]);

  const trackId = formData.get("track_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const unit = (formData.get("unit") as string)?.trim() || null;
  const totalQuantity = (formData.get("total_quantity") as string)?.trim() || null;

  if (!trackId || !name) {
    return { error: "اسم الأداة مطلوب" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_tools").insert({
    track_id: trackId,
    organization_id: profile.organization_id,
    name,
    unit,
    total_quantity: totalQuantity,
  });

  if (error) return { error: "تعذر إضافة الأداة" };

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function updateInventoryTool(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  await requireRole(["super_admin"]);

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const unit = (formData.get("unit") as string)?.trim() || null;
  const totalQuantity = (formData.get("total_quantity") as string)?.trim() || null;

  if (!name) {
    return { error: "اسم الأداة مطلوب" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_tools")
    .update({ name, unit, total_quantity: totalQuantity })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث الأداة" };

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function deleteInventoryTool(id: string) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  await supabase.from("inventory_tools").delete().eq("id", id);

  revalidatePath("/dashboard/inventory");
}

export async function upsertDailyCheck(
  toolId: string,
  checkDate: string,
  values: { morning?: string; evening?: string; actual?: string }
): Promise<InventoryFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();

  const { data: tool } = await supabase
    .from("inventory_tools")
    .select("id, organization_id, track:inventory_tracks(responsible_user_id)")
    .eq("id", toolId)
    .single<{ id: string; organization_id: string; track: { responsible_user_id: string | null } | null }>();

  if (!tool) return { error: "الأداة غير موجودة" };

  const canManage = profile.role === "super_admin";
  const isResponsible = tool.track?.responsible_user_id === profile.id;
  if (!canManage && !isResponsible) {
    return { error: "غير مصرح لك بتعديل جرد هذا المسار" };
  }

  const { error } = await supabase.from("inventory_daily_checks").upsert(
    {
      tool_id: toolId,
      organization_id: tool.organization_id,
      check_date: checkDate,
      morning_quantity: values.morning ?? null,
      evening_quantity: values.evening ?? null,
      actual_quantity: values.actual ?? null,
      checked_by: profile.id,
    },
    { onConflict: "tool_id,check_date" }
  );

  if (error) return { error: "تعذر حفظ الجرد" };

  revalidatePath("/dashboard/inventory");
  return {};
}
