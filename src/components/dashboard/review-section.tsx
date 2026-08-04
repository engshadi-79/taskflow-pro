"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewTask } from "@/lib/actions/tasks";

export function ReviewSection({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(decision: "approve" | "reject") {
    setPending(true);
    setError(null);
    const result = await reviewTask(taskId, decision, notes);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-lg border border-accent-300 bg-accent-50 p-4">
      <h2 className="text-sm font-semibold text-accent-700">بانتظار مراجعتك</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="ملاحظات (اختياري)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
      />
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("approve")}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          اعتماد
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("reject")}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent-100 disabled:opacity-60"
        >
          رفض
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
