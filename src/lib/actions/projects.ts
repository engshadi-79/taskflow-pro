"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { ProjectStatus, MilestoneStatus } from "@/lib/types/project";
import type { Priority } from "@/lib/types/task";

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export type ProjectFormState = { error?: string };

const MANAGE_ROLES = ["super_admin", "department_manager"];
const VALID_STATUSES: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
  "archived",
];

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بإنشاء مشاريع" };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const priority = (formData.get("priority") as Priority) || "medium";
  const managerId = (formData.get("manager_id") as string) || null;
  const startDate = (formData.get("start_date") as string) || null;
  const dueDate = (formData.get("due_date") as string) || null;
  // a department_manager can only create projects inside their own
  // department - matches projects_insert's RLS check exactly, just with a
  // readable error message instead of a silent RLS rejection
  const departmentId =
    profile.role === "department_manager"
      ? profile.department_id
      : (formData.get("department_id") as string) || null;

  if (!name) return { error: "اسم المشروع مطلوب" };
  if (!VALID_PRIORITIES.includes(priority)) return { error: "أولوية غير صالحة" };
  if (startDate && dueDate && dueDate < startDate) {
    return { error: "لا يمكن أن يكون الموعد النهائي قبل تاريخ البدء" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: profile.organization_id,
      department_id: departmentId,
      manager_id: managerId,
      name,
      description,
      priority,
      start_date: startDate,
      due_date: dueDate,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "تعذر إنشاء المشروع" };
  }

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${data.id}`);
}

export async function updateProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return { error: "غير مصرح لك بتعديل المشاريع" };
  }

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const status = formData.get("status") as ProjectStatus;
  const priority = (formData.get("priority") as Priority) || "medium";
  const managerId = (formData.get("manager_id") as string) || null;
  const startDate = (formData.get("start_date") as string) || null;
  const dueDate = (formData.get("due_date") as string) || null;

  if (!name) return { error: "اسم المشروع مطلوب" };
  if (!VALID_STATUSES.includes(status)) return { error: "حالة غير صالحة" };
  if (!VALID_PRIORITIES.includes(priority)) return { error: "أولوية غير صالحة" };
  if (startDate && dueDate && dueDate < startDate) {
    return { error: "لا يمكن أن يكون الموعد النهائي قبل تاريخ البدء" };
  }

  const supabase = await createClient();
  const update: Record<string, unknown> = {
    name,
    description,
    status,
    priority,
    manager_id: managerId,
    start_date: startDate,
    due_date: dueDate,
  };

  // reassigning the owning department is a super_admin-only call, same
  // boundary as the role/department fields in ProfileEditForm
  if (profile.role === "super_admin") {
    update.department_id = (formData.get("department_id") as string) || null;
  }

  const { error } = await supabase.from("projects").update(update).eq("id", id);

  if (error) {
    return { error: "تعذر تحديث المشروع" };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return {};
}

export async function changeProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return error ? { error: "تعذر تحديث حالة المشروع" } : {};
}

export async function deleteProject(id: string): Promise<ProjectFormState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بحذف المشاريع" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) return { error: "تعذر حذف المشروع" };

  revalidatePath("/dashboard/projects");
  return {};
}

export async function addProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectFormState> {
  if (!userId) return { error: "اختر موظفًا لإضافته" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return error ? { error: "تعذر إضافة العضو (قد يكون مضافًا مسبقًا)" } : {};
}

export async function removeProjectMember(
  memberRowId: string,
  projectId: string
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberRowId);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return error ? { error: "تعذر إزالة العضو" } : {};
}

export async function createMilestone(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const projectId = formData.get("project_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const dueDate = (formData.get("due_date") as string) || null;

  if (!title) return { error: "عنوان المرحلة مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    due_date: dueDate,
  });

  if (error) return { error: "تعذر إضافة المرحلة" };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {};
}

export async function updateMilestoneStatus(
  id: string,
  projectId: string,
  status: MilestoneStatus
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").update({ status }).eq("id", id);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return error ? { error: "تعذر تحديث المرحلة" } : {};
}

export async function deleteMilestone(
  id: string,
  projectId: string
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").delete().eq("id", id);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return error ? { error: "تعذر حذف المرحلة" } : {};
}
