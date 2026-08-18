"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/data/profile";
import { requireRole } from "@/lib/actions/guards";

export type InventoryFormState = { error?: string };

/** The inventory tab only exists on the project a track is linked to -
 * revalidate that project's page (a track with no project isn't shown
 * anywhere, so there's nothing to revalidate in that case). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function revalidateTrackProject(supabase: SupabaseClient<any>, trackId: string) {
  const { data: track } = await supabase
    .from("inventory_tracks")
    .select("project_id")
    .eq("id", trackId)
    .single();
  if (track?.project_id) revalidatePath(`/dashboard/projects/${track.project_id}`);
}

export async function assignTrackResponsible(trackId: string, userId: string | null) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_tracks")
    .update({ responsible_user_id: userId })
    .eq("id", trackId);

  if (error) return { error: "تعذر إسناد المسار" };

  await revalidateTrackProject(supabase, trackId);
  return {};
}

export async function assignTrackProject(trackId: string, projectId: string | null) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("inventory_tracks")
    .select("project_id")
    .eq("id", trackId)
    .single();

  const { error } = await supabase
    .from("inventory_tracks")
    .update({ project_id: projectId })
    .eq("id", trackId);

  if (error) return { error: "تعذر ربط المسار بالمشروع" };

  if (previous?.project_id) revalidatePath(`/dashboard/projects/${previous.project_id}`);
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
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

  await revalidateTrackProject(supabase, trackId);
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
  const { data: existing } = await supabase
    .from("inventory_tools")
    .select("track_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("inventory_tools")
    .update({ name, unit, total_quantity: totalQuantity })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث الأداة" };

  if (existing?.track_id) await revalidateTrackProject(supabase, existing.track_id);
  return {};
}

export async function deleteInventoryTool(id: string) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("inventory_tools")
    .select("track_id")
    .eq("id", id)
    .single();

  await supabase.from("inventory_tools").delete().eq("id", id);

  if (existing?.track_id) await revalidateTrackProject(supabase, existing.track_id);
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
    .select("id, organization_id, track:inventory_tracks(responsible_user_id, project_id)")
    .eq("id", toolId)
    .single<{
      id: string;
      organization_id: string;
      track: { responsible_user_id: string | null; project_id: string | null } | null;
    }>();

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

  if (tool.track?.project_id) revalidatePath(`/dashboard/projects/${tool.track.project_id}`);
  return {};
}
