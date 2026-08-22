"use client";

import { useActionState, useState } from "react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentFormState,
} from "@/lib/actions/departments";
import { PageHeader } from "@/components/shared/page-header";
import { FolderIcon } from "@/components/shared/icons";
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
      <PageHeader
        title="الأقسام"
        subtitle="إدارة أقسام المنظمة ومديريها"
        variant="teal"
        icon={<FolderIcon className="h-6 w-6" />}
        count={`${departments.length} قسم`}
      />

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

      <div className="overflow-hidden rounded-[18px] border border-border bg-surface">
        {/* Table below is unreadable this narrow - name/manager text wrapped
            onto multiple lines and the actions column got squeezed half off
            the screen - so md- swaps it for one full-width card per row. */}
        <div className="hidden overflow-x-auto md:block">
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
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border md:hidden">
          {departments.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
              employees={employees}
              employeeCount={employeeCounts[department.id] ?? 0}
              isEditing={editingId === department.id}
              onEdit={() => setEditingId(department.id)}
              onCancel={() => setEditingId(null)}
            />
          ))}
        </div>

        {departments.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
              <FolderIcon className="h-5 w-5" />
            </span>
            <p className="text-[13px] text-muted">لا توجد أقسام بعد</p>
          </div>
        )}
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
    <tr className="border-t border-border transition-colors hover:bg-background">
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

function DepartmentCard({
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
  const [state, formAction, pending] = useActionState(updateDepartment, initialState);

  if (isEditing) {
    return (
      <form action={formAction} className="flex flex-col gap-2.5 p-4">
        <input type="hidden" name="id" value={department.id} />
        <input
          name="name"
          defaultValue={department.name}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        />
        <select
          name="manager_id"
          defaultValue={department.manager_id ?? ""}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        >
          <option value="">بدون مدير</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-accent-500 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-border py-2 text-sm text-foreground hover:bg-accent-50"
          >
            إلغاء
          </button>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-foreground">{department.name}</span>
        <span className="shrink-0 text-[11px] text-faint">{employeeCount} موظف</span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">المدير: {department.manager?.full_name ?? "—"}</p>
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={onEdit} className="text-[12.5px] font-bold text-accent-600 hover:underline">
          تعديل
        </button>
        <DeleteButton id={department.id} />
      </div>
    </div>
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
