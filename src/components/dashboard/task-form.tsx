"use client";

import { useActionState, useState } from "react";
import type { TaskFormState } from "@/lib/actions/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/types/task";

type EmployeeOption = { id: string; full_name: string };
type ProjectOption = {
  id: string;
  name: string;
  milestones: { id: string; title: string }[];
};

const initialState: TaskFormState = {};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function TaskForm({
  task,
  employees,
  projects = [],
  action,
}: {
  task?: Task;
  employees: EmployeeOption[];
  /** Projects the current user can link this task to - omit entirely on
   * forms where linking doesn't apply. */
  projects?: ProjectOption[];
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false);
  const [projectId, setProjectId] = useState(task?.project_id ?? "");
  const milestones = projects.find((p) => p.id === projectId)?.milestones ?? [];

  return (
    <form action={formAction} className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      {task && <input type="hidden" name="id" value={task.id} />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان المهمة</span>
        <input name="title" defaultValue={task?.title} required className={inputClass} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">الوصف</span>
        <textarea
          name="description"
          defaultValue={task?.description ?? ""}
          rows={3}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">مسندة إلى</span>
          <select name="assigned_to" defaultValue={task?.assigned_to ?? ""} required className={inputClass}>
            <option value="" disabled>
              اختر موظفًا
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" defaultValue={task?.priority ?? "medium"} className={inputClass}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الحالة</span>
          <select name="status" defaultValue={task?.status ?? "new"} className={inputClass}>
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>

        {projects.length > 0 && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">المشروع</span>
              <select
                name="project_id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={inputClass}
              >
                <option value="">بدون مشروع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            {projectId && milestones.length > 0 && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">المرحلة</span>
                <select
                  name="milestone_id"
                  defaultValue={task?.milestone_id ?? ""}
                  className={inputClass}
                >
                  <option value="">بدون مرحلة</option>
                  {milestones.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            name="is_recurring"
            defaultChecked={task?.is_recurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-foreground">مهمة متكررة</span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">تاريخ البدء</span>
          <input type="date" name="start_date" defaultValue={task?.start_date ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">وقت البدء</span>
          <input type="time" name="start_time" defaultValue={task?.start_time ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">تاريخ الاستحقاق</span>
          <input type="date" name="due_date" defaultValue={task?.due_date ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">وقت الاستحقاق</span>
          <input type="time" name="due_time" defaultValue={task?.due_time ?? ""} className={inputClass} />
        </label>
      </div>

      {isRecurring && (
        <label className="block sm:w-1/2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">نمط التكرار</span>
          <select
            name="recurrence_pattern"
            defaultValue={task?.recurrence_pattern ?? "weekly"}
            className={inputClass}
          >
            <option value="daily">يوميًا</option>
            <option value="weekly">أسبوعيًا</option>
            <option value="monthly">شهريًا</option>
            <option value="yearly">سنويًا</option>
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : task ? "حفظ التعديلات" : "إنشاء المهمة"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
