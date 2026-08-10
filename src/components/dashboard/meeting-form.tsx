"use client";

import { useActionState, useState } from "react";
import { createMeeting, type MeetingFormState } from "@/lib/actions/meetings";

const initialState: MeetingFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type EmployeeOption = { id: string; full_name: string };
type ProjectOption = { id: string; name: string };

export function MeetingForm({
  employees,
  projects,
}: {
  employees: EmployeeOption[];
  projects: ProjectOption[];
}) {
  const [state, formAction, pending] = useActionState(createMeeting, initialState);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  function toggleAttendee(id: string) {
    setSelectedAttendees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <form action={formAction} className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الاجتماع</span>
        <input name="title" required className={inputClass} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">التاريخ</span>
          <input type="date" name="meeting_date" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الوقت</span>
          <input type="time" name="meeting_time" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المكان</span>
          <input name="location" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المشروع (اختياري)</span>
          <select name="project_id" defaultValue="" className={inputClass}>
            <option value="">بدون مشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-foreground">الحضور</span>
        <div className="flex flex-wrap gap-2">
          {employees.map((e) => (
            <label
              key={e.id}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                selectedAttendees.includes(e.id)
                  ? "border-accent-500 bg-accent-50 text-accent-700"
                  : "border-border bg-background text-muted"
              }`}
            >
              <input
                type="checkbox"
                name="attendee_ids"
                value={e.id}
                checked={selectedAttendees.includes(e.id)}
                onChange={() => toggleAttendee(e.id)}
                className="hidden"
              />
              {e.full_name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإنشاء..." : "إنشاء الاجتماع"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
