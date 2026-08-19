"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForReview, reviewTask } from "@/lib/actions/tasks";

export function MobileSubmitForReview({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await submitForReview(taskId);
          setPending(false);
          if (result?.error) setError(result.error);
          else router.refresh();
        }}
        className="w-full rounded-[12px] bg-accent-600 py-3 text-[13px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? "جارٍ الإرسال..." : "إرسال للمراجعة"}
      </button>
      {error && <p className="mt-1.5 text-[11.5px] text-brand-red-600">{error}</p>}
    </div>
  );
}

export function MobileReviewPanel({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(decision: "approve" | "reject") {
    if (decision === "reject" && !notes.trim()) {
      setError("سبب الإرجاع مطلوب");
      return;
    }
    setPending(true);
    setError(null);
    const result = await reviewTask(taskId, decision, notes);
    setPending(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="rounded-[14px] border border-orange-200 bg-orange-50 p-3.5">
      <div className="mb-2.5 text-[12.5px] font-extrabold text-orange-800">مراجعة المهمة</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="ملاحظات (مطلوبة عند الرفض)"
        className="mb-2.5 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-accent-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("approve")}
          className="flex-1 rounded-[10px] bg-green-600 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-60"
        >
          قبول
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("reject")}
          className="flex-1 rounded-[10px] border border-brand-red-500 bg-surface py-2.5 text-[12.5px] font-extrabold text-brand-red-600 disabled:opacity-60"
        >
          رفض
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11.5px] text-brand-red-600">{error}</p>}
    </div>
  );
}
