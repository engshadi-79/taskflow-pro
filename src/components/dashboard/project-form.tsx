"use client";

import { useActionState } from "react";
import { createProject, updateProject, type ProjectFormState } from "@/lib/actions/projects";
import { PROJECT_STATUS_LABEL, type Project, type ProjectStatus } from "@/lib/types/project";

type EmployeeOption = { id: string; full_name: string };
type DepartmentOption = { id: string; name: string };

const initialState: ProjectFormState = {};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function ProjectForm({
  project,
  employees,
  departments,
  isSuperAdmin,
}: {
  project?: Project;
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  /** Only super_admin may reassign the owning department - a
   * department_manager's project stays in their own department by
   * construction (see createProject in lib/actions/projects.ts). */
  isSuperAdmin: boolean;
}) {
  const action = project ? updateProject : createProject;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      {project && <input type="hidden" name="id" value={project.id} />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">اسم المشروع</span>
        <input name="name" defaultValue={project?.name} required className={inputClass} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">الوصف</span>
        <textarea
          name="description"
          defaultValue={project?.description ?? ""}
          rows={3}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">مدير المشروع</span>
          <select name="manager_id" defaultValue={project?.manager_id ?? ""} className={inputClass}>
            <option value="">بدون مدير</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </label>

        {project && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الحالة</span>
            <select name="status" defaultValue={project.status} className={inputClass}>
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
        )}

        {isSuperAdmin && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">القسم</span>
            <select name="department_id" defaultValue={project?.department_id ?? ""} className={inputClass}>
              <option value="">بدون قسم (على مستوى المؤسسة)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">تاريخ البدء</span>
          <input type="date" name="start_date" defaultValue={project?.start_date ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الموعد النهائي</span>
          <input type="date" name="due_date" defaultValue={project?.due_date ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : project ? "حفظ التعديلات" : "إنشاء المشروع"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
