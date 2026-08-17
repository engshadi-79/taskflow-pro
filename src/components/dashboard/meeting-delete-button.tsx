"use client";

import { useState } from "react";
import { deleteMeeting } from "@/lib/actions/meetings";

export function MeetingDeleteButton({ meetingId }: { meetingId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!confirm("حذف هذا الاجتماع نهائيًا؟")) return;
          setPending(true);
          setError(null);
          const result = await deleteMeeting(meetingId);
          setPending(false);
          if (result.error) setError(result.error);
        }}
        className="text-[12.5px] font-bold text-brand-red-500 hover:underline disabled:opacity-60"
      >
        حذف
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
