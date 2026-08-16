"use client";

import { useActionState, useState } from "react";
import { updateEmployee, toggleEmployeeActive, deleteEmployee } from "@/lib/actions/users";
import type { Profile, Role } from "@/lib/types/roles";

type DepartmentOption = { id: string; name: string };
type ColleagueOption = { id: string; full_name: string };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

/**
 * super_admin sees every field here. department_manager only ever sees
 * job_title/manager_id (never role/department/phone/full_name) - matching
 * update_department_employee in supabase/department_manager_edit.sql, the
 * function this form's submit ultimately runs for a department_manager,
 * which is itself hard-limited to those two columns. Hiding the rest here is
 * just UX (a manager couldn't change them even if the inputs were present);
 * the actual enforcement lives in that function and in requireRole.
 */
export function ProfileEditForm({
  employee,
  departments,
  colleagues,
  viewerRole,
}: {
  employee: Profile;
  departments: DepartmentOption[];
  colleagues: ColleagueOption[];
  viewerRole: Role;
}) {
  const [state, formAction, pending] = useActionState(updateEmployee, {});
  const [active, setActive] = useState(employee.is_active);
  const [togglePending, setTogglePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const isSuperAdmin = viewerRole === "super_admin";

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-extrabold text-foreground">إدارة الحساب</h2>
      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={employee.id} />
        {isSuperAdmin && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">الاسم الكامل</span>
              <input name="full_name" defaultValue={employee.full_name} required className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">رقم الهاتف</span>
              <input name="phone" defaultValue={employee.phone ?? ""} className={inputClass} />
            </label>
          </>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المسمى الوظيفي</span>
          <input name="job_title" defaultValue={employee.job_title ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المدير المباشر</span>
          <select name="manager_id" defaultValue={employee.manager_id ?? ""} className={inputClass}>
            <option value="">بدون مدير مباشر</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </label>
        {isSuperAdmin && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">الدور</span>
              <select name="role" defaultValue={employee.role} className={inputClass}>
                <option value="employee">موظف</option>
                <option value="department_manager">مدير قسم</option>
                <option value="super_admin">مدير عام</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-foreground">القسم</span>
              <select name="department_id" defaultValue={employee.department_id ?? ""} className={inputClass}>
                <option value="">بدون قسم</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                disabled={togglePending}
                onClick={async () => {
                  setTogglePending(true);
                  const next = !active;
                  const result = await toggleEmployeeActive(employee.id, next);
                  if (result?.error) {
                    alert(result.error);
                  } else {
                    setActive(next);
                  }
                  setTogglePending(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60 ${
                  active ? "bg-accent-50 text-accent-700" : "bg-border text-muted"
                }`}
              >
                {active ? "نشط" : "معطّل"}
              </button>

              <button
                type="button"
                disabled={deletePending}
                onClick={async () => {
                  if (!confirm("هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.")) return;
                  setDeletePending(true);
                  const result = await deleteEmployee(employee.id);
                  setDeletePending(false);
                  if (result?.error) alert(result.error);
                }}
                className="text-sm text-red-600 hover:underline disabled:opacity-60"
              >
                حذف الحساب
              </button>
            </>
          )}

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        </div>
      </form>
    </div>
  );
}
