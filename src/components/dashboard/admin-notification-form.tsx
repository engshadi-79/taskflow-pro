"use client";

import { useActionState, useMemo, useState } from "react";
import { sendAdminNotification, type AdminNotificationFormState } from "@/lib/actions/admin-notifications";

const initialState: AdminNotificationFormState = {};

const TYPE_OPTIONS = [
  { value: "general", label: "عام" },
  { value: "announcement", label: "تعميم" },
  { value: "reminder", label: "تذكير" },
  { value: "warning", label: "تنبيه" },
  { value: "urgent", label: "عاجل" },
  { value: "meeting", label: "اجتماع" },
  { value: "system", label: "نظام" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

const LARGE_SEND_THRESHOLD = 50;

type EmployeeOption = { id: string; full_name: string };
type DepartmentOption = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function AdminNotificationForm({
  employees,
  departments,
  isDepartmentManager,
  ownDepartmentId,
  ownDepartmentName,
}: {
  employees: EmployeeOption[];
  /** Empty for department_manager - they target their own department by
   * a fixed toggle, not a picker, since it's the only option they have. */
  departments: DepartmentOption[];
  isDepartmentManager: boolean;
  ownDepartmentId?: string | null;
  ownDepartmentName?: string | null;
}) {
  const [state, formAction, pending] = useActionState(sendAdminNotification, initialState);
  const [targetType, setTargetType] = useState<"specific" | "department" | "all">(
    isDepartmentManager ? "department" : "specific"
  );
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.full_name.includes(search.trim())),
    [employees, search]
  );

  const recipientCountEstimate =
    targetType === "specific" ? selectedIds.length : targetType === "department" ? null : null;

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const isLarge = targetType !== "specific" || selectedIds.length >= LARGE_SEND_THRESHOLD;
    if (isLarge && !confirming) {
      e.preventDefault();
      setConfirming(true);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-5 rounded-[18px] border border-border bg-surface p-6">
      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">محتوى الإشعار</h3>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الإشعار</span>
          <input name="title" required maxLength={120} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">نص الرسالة</span>
          <textarea name="message" required rows={4} maxLength={2000} className={inputClass} />
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">المستلمون</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${targetType === "specific" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
            <input type="radio" name="target_type" value="specific" checked={targetType === "specific"} onChange={() => setTargetType("specific")} className="hidden" />
            موظفون محددون
          </label>
          {isDepartmentManager ? (
            <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${targetType === "department" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
              <input type="radio" name="target_type" value="department" checked={targetType === "department"} onChange={() => setTargetType("department")} className="hidden" />
              قسمي بالكامل{ownDepartmentName ? ` (${ownDepartmentName})` : ""}
            </label>
          ) : (
            <>
              <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${targetType === "department" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
                <input type="radio" name="target_type" value="department" checked={targetType === "department"} onChange={() => setTargetType("department")} className="hidden" />
                قسم
              </label>
              <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${targetType === "all" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
                <input type="radio" name="target_type" value="all" checked={targetType === "all"} onChange={() => setTargetType("all")} className="hidden" />
                جميع الموظفين
              </label>
            </>
          )}
        </div>

        {targetType === "department" && !isDepartmentManager && (
          <select name="department_id" required className={inputClass}>
            <option value="">اختر القسم</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        {targetType === "department" && isDepartmentManager && ownDepartmentId && (
          <input type="hidden" name="department_id" value={ownDepartmentId} />
        )}

        {targetType === "specific" && (
          <div className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن موظف..."
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
              />
              <button type="button" onClick={() => setSelectedIds(filteredEmployees.map((e) => e.id))} className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-bold text-muted hover:bg-background">
                تحديد الكل
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-bold text-muted hover:bg-background">
                إزالة الكل
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {filteredEmployees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground hover:bg-background">
                  <input type="checkbox" name="user_id" value={emp.id} checked={selectedIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                  {emp.full_name}
                </label>
              ))}
              {filteredEmployees.length === 0 && <p className="px-2 py-3 text-[12.5px] text-muted">لا نتائج</p>}
            </div>
          </div>
        )}

        {recipientCountEstimate !== null && (
          <p className="mt-2 text-[12px] font-bold text-accent-600">{recipientCountEstimate} موظف محدَّد</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="block sm:w-1/2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">النوع</span>
          <select name="type" defaultValue="general" className={inputClass}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block sm:w-1/2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" defaultValue="normal" className={inputClass}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      {confirming && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-[13px] text-orange-800">
          <p className="mb-2 font-bold">
            {targetType === "all"
              ? "هل أنت متأكد من إرسال هذا الإشعار إلى جميع الموظفين؟"
              : targetType === "department"
                ? "هل أنت متأكد من إرسال هذا الإشعار لكل موظفي القسم المحدَّد؟"
                : `هل أنت متأكد من إرسال هذا الإشعار إلى ${selectedIds.length} موظفًا؟`}
          </p>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-orange-600 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-orange-700">
              تأكيد الإرسال
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-foreground hover:bg-background">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإرسال..." : "إرسال الآن"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
