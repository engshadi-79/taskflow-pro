"use client";

import { useActionState, useState } from "react";
import { createMeeting, updateMeeting, type MeetingFormState } from "@/lib/actions/meetings";
import type { Meeting } from "@/lib/types/meeting";

const initialState: MeetingFormState = {};
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type EmployeeOption = { id: string; full_name: string };
type ProjectOption = { id: string; name: string };

export function MeetingForm({
  meeting,
  employees,
  projects,
}: {
  meeting?: Meeting;
  employees: EmployeeOption[];
  projects: ProjectOption[];
}) {
  const action = meeting ? updateMeeting : createMeeting;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  return (
    <form action={formAction} className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      {meeting && <input type="hidden" name="id" value={meeting.id} />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الاجتماع</span>
        <input name="title" defaultValue={meeting?.title} required className={inputClass} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">التاريخ</span>
          <input type="date" name="meeting_date" defaultValue={meeting?.meeting_date} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الوقت</span>
          <input type="time" name="meeting_time" defaultValue={meeting?.meeting_time ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المكان</span>
          <input name="location" defaultValue={meeting?.location ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">المشروع (اختياري)</span>
          <select name="project_id" defaultValue={meeting?.project_id ?? ""} className={inputClass}>
            <option value="">بدون مشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!meeting && (
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
                  onChange={() =>
                    setSelectedAttendees((prev) =>
                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                    )
                  }
                  className="hidden"
                />
                {e.full_name}
              </label>
            ))}
          </div>
        </div>
      )}
      {meeting && (
        <p className="text-[11.5px] text-faint">
          إدارة الحضور تتم من صفحة الاجتماع نفسها، ضمن قسم &quot;الحضور&quot;.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : meeting ? "حفظ التعديلات" : "إنشاء الاجتماع"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
