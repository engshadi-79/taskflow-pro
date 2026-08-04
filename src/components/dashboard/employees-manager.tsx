"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createEmployee,
  toggleEmployeeActive,
  deleteEmployee,
  type UserFormState,
} from "@/lib/actions/users";
import type { EmployeeStats } from "@/lib/employee-stats";
import type { Profile, Role } from "@/lib/types/roles";

type DepartmentOption = { id: string; name: string };

const initialState: UserFormState = {};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

const BANDS = [
  "linear-gradient(135deg,var(--accent-500),#5C93FF)",
  "linear-gradient(135deg,var(--green-500),var(--green-600))",
  "linear-gradient(135deg,var(--orange-500),var(--orange-600))",
  "linear-gradient(135deg,var(--pink-500),var(--pink-600))",
  "linear-gradient(135deg,var(--purple-500),var(--purple-600))",
];

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
}

export function EmployeesManager({
  employees,
  departments,
  stats,
  currentUserId,
  canManage,
}: {
  employees: Profile[];
  departments: DepartmentOption[];
  stats: Record<string, EmployeeStats>;
  currentUserId: string;
  canManage: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] text-foreground">الفريق</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">{employees.length} عضوًا في الفريق</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-[10px] bg-accent-500 px-5 py-2.5 text-[13.5px] font-extrabold text-white hover:bg-accent-600"
          >
            {showCreate ? "إلغاء" : "+ إضافة عضو"}
          </button>
        )}
      </div>

      {canManage && showCreate && <CreateEmployeeForm departments={departments} />}

      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee, i) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            department={departments.find((d) => d.id === employee.department_id)?.name}
            stats={stats[employee.id] ?? { taskCount: 0, completionRate: 0, avgDays: 0 }}
            band={BANDS[i % BANDS.length]}
            canManage={canManage}
            disableDelete={employee.id === currentUserId}
          />
        ))}
        {employees.length === 0 && <p className="text-sm text-muted">لا يوجد أعضاء بعد</p>}
      </div>
    </div>
  );
}

function EmployeeCard({
  employee,
  department,
  stats,
  band,
  canManage,
  disableDelete,
}: {
  employee: Profile;
  department?: string;
  stats: EmployeeStats;
  band: string;
  canManage: boolean;
  disableDelete: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface text-center">
      <div className="h-14" style={{ background: band }} />
      <div className="px-6 pb-6">
        <div
          className="relative z-2 -mt-8 mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-surface text-[22px] font-extrabold text-white"
          style={{ background: band }}
        >
          {initials(employee.full_name)}
        </div>
        <h3 className="text-[15px] font-extrabold text-foreground">{employee.full_name}</h3>
        <p className="mb-4 text-[12.5px] text-faint">
          {employee.job_title || ROLE_LABEL[employee.role]}
          {department ? ` — ${department}` : ""}
        </p>

        <div className="flex justify-center gap-5.5 border-t border-border pt-4">
          <div>
            <b className="block font-display text-[17px] text-foreground">{stats.taskCount}</b>
            <span className="text-[11px] text-faint">مهام</span>
          </div>
          <div>
            <b className="block font-display text-[17px] text-foreground">{stats.completionRate}٪</b>
            <span className="text-[11px] text-faint">إنجاز</span>
          </div>
          <div>
            <b className="block font-display text-[17px] text-foreground">{stats.avgDays}</b>
            <span className="text-[11px] text-faint">يوم متوسط</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 border-t border-border pt-4 text-sm">
          <Link href={`/dashboard/profile/${employee.id}`} className="font-bold text-accent-600 hover:underline">
            عرض الملف
          </Link>
          {canManage && (
            <>
              <ActiveToggle id={employee.id} isActive={employee.is_active} />
              <DeleteButton id={employee.id} disabled={disableDelete} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input name={name} type={type} required={required} className={inputClass} />
    </label>
  );
}

function CreateEmployeeForm({ departments }: { departments: DepartmentOption[] }) {
  const [state, formAction, pending] = useActionState(createEmployee, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-[18px] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="الاسم الكامل" name="full_name" required />
      <Field label="البريد الإلكتروني" name="email" type="email" required />
      <Field label="كلمة المرور المؤقتة" name="password" type="password" required />
      <Field label="رقم الهاتف" name="phone" />
      <Field label="المسمى الوظيفي" name="job_title" />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">الدور</span>
        <select name="role" required defaultValue="employee" className={inputClass}>
          <option value="employee">موظف</option>
          <option value="department_manager">مدير قسم</option>
          <option value="super_admin">مدير عام</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">القسم</span>
        <select name="department_id" defaultValue="" className={inputClass}>
          <option value="">بدون قسم</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}

function ActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [active, setActive] = useState(isActive);
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const next = !active;
        await toggleEmployeeActive(id, next);
        setActive(next);
        setPending(false);
      }}
      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
        active ? "bg-accent-50 text-accent-700" : "bg-border text-muted"
      }`}
    >
      {active ? "نشط" : "معطّل"}
    </button>
  );
}

function DeleteButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);

  if (disabled) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.")) return;
        setPending(true);
        const result = await deleteEmployee(id);
        setPending(false);
        if (result?.error) {
          alert(result.error);
        }
      }}
      className="text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
