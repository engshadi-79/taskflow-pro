"use client";

import { useActionState, useState } from "react";
import {
  updateEmployee,
  toggleEmployeeActive,
  deleteEmployee,
  resetEmployeePassword,
} from "@/lib/actions/users";
import { Modal } from "@/components/shared/modal";
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
  const [showResetPassword, setShowResetPassword] = useState(false);
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
                onClick={() => setShowResetPassword(true)}
                className="text-sm font-bold text-accent-600 hover:underline"
              >
                تعيين كلمة مرور جديدة
              </button>

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

      {showResetPassword && (
        <ResetEmployeePasswordDialog
          employeeId={employee.id}
          onClose={() => setShowResetPassword(false)}
        />
      )}
    </div>
  );
}

function ResetEmployeePasswordDialog({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }
    setPending(true);
    setError(null);
    const result = await resetEmployeePassword(employeeId, newPassword);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <Modal
      title="تعيين كلمة مرور جديدة"
      subtitle="لن تتمكن من رؤية كلمة المرور القديمة أبدًا — يمكنك فقط تعيين واحدة جديدة"
      onClose={onClose}
    >
      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-bold text-green-600">
            تم تعيين كلمة المرور الجديدة بنجاح
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700"
          >
            إغلاق
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reset_new_password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              كلمة المرور الجديدة
            </label>
            <input
              id="reset_new_password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
            <p className="mt-1 text-[11.5px] text-muted">8 أحرف على الأقل</p>
          </div>

          <div>
            <label
              htmlFor="reset_confirm_password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              تأكيد كلمة المرور
            </label>
            <input
              id="reset_confirm_password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-border px-5 py-2.5 text-sm font-bold text-muted hover:bg-background"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
