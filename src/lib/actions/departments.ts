"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/guards";

export type DepartmentFormState = { error?: string };

export async function createDepartment(
  _prevState: DepartmentFormState,
  formData: FormData
): Promise<DepartmentFormState> {
  const profile = await requireRole(["super_admin"]);
  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    return { error: "اسم القسم مطلوب" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .insert({ organization_id: profile.organization_id, name });

  if (error) {
    return { error: "تعذر إنشاء القسم" };
  }

  revalidatePath("/dashboard/departments");
  return {};
}

export async function updateDepartment(
  _prevState: DepartmentFormState,
  formData: FormData
): Promise<DepartmentFormState> {
  await requireRole(["super_admin"]);

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const managerId = (formData.get("manager_id") as string) || null;

  if (!name) {
    return { error: "اسم القسم مطلوب" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ name, manager_id: managerId })
    .eq("id", id);

  if (error) {
    return { error: "تعذر تحديث القسم" };
  }

  revalidatePath("/dashboard/departments");
  return {};
}

export async function deleteDepartment(id: string) {
  await requireRole(["super_admin"]);

  const supabase = await createClient();
  await supabase.from("departments").delete().eq("id", id);

  revalidatePath("/dashboard/departments");
}
