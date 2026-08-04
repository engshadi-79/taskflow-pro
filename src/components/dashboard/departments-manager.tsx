"use client";

import { useActionState, useState } from "react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentFormState,
} from "@/lib/actions/departments";
import type { DepartmentWithManager } from "@/lib/types/department";

type EmployeeOption = { id: string; full_name: string };

const initialState: DepartmentFormState = {};

export function DepartmentsManager({
  departments,
  employees,
  employeeCounts,
}: {
  departments: DepartmentWithManager[];
  employees: EmployeeOption[];
  employeeCounts: Record<string, number>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createState, createAction, creating] = useActionState(
    createDepartment,
    initialState
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[22px] text-foreground">الأقسام</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">{departments.length} قسمًا في المنظمة</p>
      </div>

      <form
        action={createAction}
        className="flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4"
      >
        <div>
          <label
            htmlFor="new-dept-name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            اسم القسم الجديد
          </label>
          <input
            id="new-dept-name"
            name="name"
            required
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {creating ? "جارٍ الإضافة..." : "إضافة قسم"}
        </button>
        {createState?.error && (
          <p className="text-sm text-red-600">{createState.error}</p>
        )}
      </form>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs font-medium text-muted">
            <tr>
              <th className="px-4 py-3 text-start">القسم</th>
              <th className="px-4 py-3 text-start">المدير</th>
              <th className="px-4 py-3 text-start">عدد الموظفين</th>
              <th className="px-4 py-3 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <DepartmentRow
                key={department.id}
                department={department}
                employees={employees}
                employeeCount={employeeCounts[department.id] ?? 0}
                isEditing={editingId === department.id}
                onEdit={() => setEditingId(department.id)}
                onCancel={() => setEditingId(null)}
              />
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  لا توجد أقسام بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartmentRow({
  department,
  employees,
  employeeCount,
  isEditing,
  onEdit,
  onCancel,
}: {
  department: DepartmentWithManager;
  employees: EmployeeOption[];
  employeeCount: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateDepartment,
    initialState
  );

  if (isEditing) {
    return (
      <tr className="border-t border-border">
        <td colSpan={4} className="px-4 py-3">
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={department.id} />
            <input
              name="name"
              defaultValue={department.name}
              required
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
            <select
              name="manager_id"
              defaultValue={department.manager_id ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            >
              <option value="">بدون مدير</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent-50"
            >
              إلغاء
            </button>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 text-foreground">{department.name}</td>
      <td className="px-4 py-3 text-muted">{department.manager?.full_name ?? "—"}</td>
      <td className="px-4 py-3 text-muted">{employeeCount}</td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-accent-600 hover:underline"
          >
            تعديل
          </button>
          <DeleteButton id={department.id} />
        </div>
      </td>
    </tr>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
        setPending(true);
        await deleteDepartment(id);
        setPending(false);
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
