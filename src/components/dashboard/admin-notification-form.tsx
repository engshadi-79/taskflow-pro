"use client";

import { useActionState, useMemo, useState } from "react";
import { submitAdminNotification, type AdminNotificationFormState } from "@/lib/actions/admin-notifications";
import { createAdminNotificationTemplate } from "@/lib/actions/admin-notification-templates";
import { NoteIcon } from "@/components/shared/icons";

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

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "يوميًا" },
  { value: "weekly", label: "أسبوعيًا" },
  { value: "monthly", label: "شهريًا" },
  { value: "yearly", label: "سنويًا" },
];

const WEEKDAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const LARGE_SEND_THRESHOLD = 50;

function minDateTimeValue(minutesFromNow: number) {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

type EmployeeOption = { id: string; full_name: string };
type DepartmentOption = { id: string; name: string };
type TemplateOption = { id: string; name: string; title: string; message: string; type: string; priority: string };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function AdminNotificationForm({
  employees,
  departments,
  templates,
  isDepartmentManager,
  ownDepartmentId,
  ownDepartmentName,
}: {
  employees: EmployeeOption[];
  /** Empty for department_manager - they target their own department by
   * a fixed toggle, not a picker, since it's the only option they have. */
  departments: DepartmentOption[];
  templates: TemplateOption[];
  isDepartmentManager: boolean;
  ownDepartmentId?: string | null;
  ownDepartmentName?: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitAdminNotification, initialState);
  const [targetType, setTargetType] = useState<"specific" | "department" | "all">(
    isDepartmentManager ? "department" : "specific"
  );
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("general");
  const [priority, setPriority] = useState("normal");

  const [sendMode, setSendMode] = useState<"now" | "scheduled" | "recurring">("now");
  const [recurrencePattern, setRecurrencePattern] = useState("daily");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

  const [templateId, setTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);

  const minScheduled = useMemo(() => minDateTimeValue(5), []);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.full_name.includes(search.trim())),
    [employees, search]
  );

  const recipientCountEstimate =
    targetType === "specific" ? selectedIds.length : targetType === "department" ? null : null;

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleRecurrenceDay(day: number) {
    setRecurrenceDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    setTitle(t.title);
    setMessage(t.message);
    setType(t.type);
    setPriority(t.priority);
  }

  async function handleSaveTemplate() {
    setTemplateError(null);
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      setTemplateError("اسم القالب مطلوب");
      return;
    }
    if (!title || !message) {
      setTemplateError("اكتب العنوان والرسالة أولًا");
      return;
    }
    const fd = new FormData();
    fd.set("name", trimmedName);
    fd.set("title", title);
    fd.set("message", message);
    fd.set("type", type);
    fd.set("priority", priority);
    const result = await createAdminNotificationTemplate({}, fd);
    if (result?.error) {
      setTemplateError(result.error);
      return;
    }
    setTemplateSaved(true);
    setSavingTemplate(false);
    setTemplateName("");
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
      <input type="hidden" name="send_mode" value={sendMode} />

      {templates.length > 0 && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">استخدام قالب جاهز (اختياري)</span>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className={inputClass}
          >
            <option value="">بدون قالب</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13.5px] font-extrabold text-foreground">محتوى الإشعار</h3>
          {!savingTemplate && !templateSaved && (
            <button
              type="button"
              onClick={() => setSavingTemplate(true)}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-accent-600 hover:underline"
            >
              <NoteIcon className="h-3.5 w-3.5" />
              حفظ كقالب
            </button>
          )}
          {templateSaved && <span className="text-[12px] font-bold text-green-600">تم حفظ القالب</span>}
        </div>

        {savingTemplate && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-background p-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="اسم القالب"
              className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
            />
            <button type="button" onClick={handleSaveTemplate} className="rounded-full bg-accent-500 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-accent-600">
              حفظ
            </button>
            <button type="button" onClick={() => setSavingTemplate(false)} className="rounded-full border border-border px-3 py-1.5 text-[11.5px] text-muted hover:bg-surface">
              إلغاء
            </button>
          </div>
        )}
        {templateError && <p className="mb-3 text-[12px] text-red-600">{templateError}</p>}

        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الإشعار</span>
          <input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">نص الرسالة</span>
          <textarea name="message" required rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
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
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block sm:w-1/2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية</span>
          <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">وقت الإرسال</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${sendMode === "now" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
            <input type="radio" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="hidden" />
            إرسال الآن
          </label>
          <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${sendMode === "scheduled" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
            <input type="radio" checked={sendMode === "scheduled"} onChange={() => setSendMode("scheduled")} className="hidden" />
            جدولة لوقت لاحق
          </label>
          <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${sendMode === "recurring" ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
            <input type="radio" checked={sendMode === "recurring"} onChange={() => setSendMode("recurring")} className="hidden" />
            إرسال دوري متكرر
          </label>
        </div>

        {sendMode === "scheduled" && (
          <label className="block sm:w-1/2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">وقت الإرسال</span>
            <input type="datetime-local" name="scheduled_at" required min={minScheduled} className={inputClass} />
          </label>
        )}

        {sendMode === "recurring" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <label className="block sm:w-1/3">
                <span className="mb-1.5 block text-sm font-medium text-foreground">التكرار</span>
                <select name="recurrence_pattern" value={recurrencePattern} onChange={(e) => setRecurrencePattern(e.target.value)} className={inputClass}>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:w-1/3">
                <span className="mb-1.5 block text-sm font-medium text-foreground">كل عدد</span>
                <input type="number" name="recurrence_interval" min={1} defaultValue={1} className={inputClass} />
              </label>
              <label className="block sm:w-1/3">
                <span className="mb-1.5 block text-sm font-medium text-foreground">تاريخ الانتهاء (اختياري)</span>
                <input type="date" name="end_date" className={inputClass} />
              </label>
            </div>

            {recurrencePattern === "weekly" && (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">أيام التكرار</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <label key={day} className={`cursor-pointer rounded-full border px-2.5 py-1 text-[12px] font-bold ${recurrenceDays.includes(day) ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"}`}>
                      <input type="checkbox" name="recurrence_day" value={day} checked={recurrenceDays.includes(day)} onChange={() => toggleRecurrenceDay(day)} className="hidden" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="block sm:w-1/2">
              <span className="mb-1.5 block text-sm font-medium text-foreground">وقت أول إرسال</span>
              <input type="datetime-local" name="first_run_at" required min={minScheduled} className={inputClass} />
            </label>
          </div>
        )}
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
          {pending
            ? "جارٍ الإرسال..."
            : sendMode === "scheduled"
              ? "جدولة الإرسال"
              : sendMode === "recurring"
                ? "بدء التكرار"
                : "إرسال الآن"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
