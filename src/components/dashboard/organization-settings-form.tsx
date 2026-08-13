"use client";

import { useActionState, useState } from "react";
import { updateOrganizationSettings, type OrgSettingsFormState } from "@/lib/actions/organization-settings";
import { TIMEZONE_OPTIONS, WEEKDAY_LABELS, type Organization } from "@/lib/types/organization";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";

const initialState: OrgSettingsFormState = {};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function OrganizationSettingsForm({ organization }: { organization: Organization }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, initialState);
  const [workDays, setWorkDays] = useState<number[]>(organization.work_days);
  const [submitted, setSubmitted] = useState(false);

  function toggleDay(day: number) {
    setSubmitted(false);
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  return (
    <form
      action={formAction}
      onChange={() => setSubmitted(false)}
      onSubmit={() => setSubmitted(true)}
      className="space-y-6 rounded-[18px] border border-border bg-surface p-6"
    >
      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">الهوية</h3>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">اسم المؤسسة</span>
          <input name="name" defaultValue={organization.name} required maxLength={120} className={inputClass} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المنطقة الزمنية</span>
          <select name="timezone" defaultValue={organization.timezone} className={inputClass}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">ساعات العمل</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, day) => (
            <label
              key={day}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                workDays.includes(day) ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border text-muted"
              }`}
            >
              <input type="checkbox" name="work_days" value={day} checked={workDays.includes(day)} onChange={() => toggleDay(day)} className="hidden" />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="block sm:w-1/2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">بداية الدوام</span>
            <input type="time" name="work_start_time" defaultValue={organization.work_start_time.slice(0, 5)} required className={inputClass} />
          </label>
          <label className="block sm:w-1/2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">نهاية الدوام</span>
            <input type="time" name="work_end_time" defaultValue={organization.work_end_time.slice(0, 5)} required className={inputClass} />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[13.5px] font-extrabold text-foreground">القيم الافتراضية للمهام</h3>
        <div className="flex flex-wrap gap-4">
          <label className="block sm:w-1/2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الأولوية الافتراضية للمهام الجديدة</span>
            <select name="default_task_priority" defaultValue={organization.default_task_priority} className={inputClass}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </label>
          <label className="block sm:w-1/2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">مدة SLA الافتراضية (بالساعات)</span>
            <input type="number" name="default_sla_hours" min={1} defaultValue={organization.default_sla_hours} required className={inputClass} />
          </label>
        </div>
        <p className="mt-2 text-[11.5px] text-faint">
          تُستخدم عند إنشاء مهمة جديدة أو سياسة SLA جديدة كقيمة مبدئية، ولا تُغيّر السياسات الحالية.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {submitted && !pending && !state?.error && <p className="text-sm font-bold text-green-600">تم الحفظ</p>}
      </div>
    </form>
  );
}
