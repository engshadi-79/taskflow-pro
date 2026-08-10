"use client";

import { useState } from "react";
import { addMeetingAttendee, removeMeetingAttendee } from "@/lib/actions/meetings";
import { Avatar } from "@/components/shared/avatar";

type EmployeeOption = { id: string; full_name: string };
type AttendeeRow = { id: string; user: { id: string; full_name: string; avatar_url: string | null } | null };

export function MeetingAttendees({
  meetingId,
  attendees,
  nonAttendees,
  canManage,
}: {
  meetingId: string;
  attendees: AttendeeRow[];
  nonAttendees: EmployeeOption[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap items-end gap-2.5">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          >
            <option value="">اختر موظفًا</option>
            {nonAttendees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await addMeetingAttendee(meetingId, selected);
              setPending(false);
              if (result?.error) setError(result.error);
              else setSelected("");
            }}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {attendees.map((a) =>
          a.user ? (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3.5 py-2"
            >
              <div className="flex items-center gap-2.5">
                <Avatar src={a.user.avatar_url} name={a.user.full_name} size={28} decorative />
                <span className="text-sm font-bold text-foreground">{a.user.full_name}</span>
              </div>
              {canManage && <RemoveButton id={a.id} meetingId={meetingId} />}
            </li>
          ) : null
        )}
        {attendees.length === 0 && <p className="text-sm text-muted sm:col-span-2">لا يوجد حضور بعد</p>}
      </ul>
    </div>
  );
}

function RemoveButton({ id, meetingId }: { id: string; meetingId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await removeMeetingAttendee(id, meetingId);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      إزالة
    </button>
  );
}
