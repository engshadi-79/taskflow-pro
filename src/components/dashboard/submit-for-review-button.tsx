"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForReview } from "@/lib/actions/tasks";

export function SubmitForReviewButton({ taskId }: { taskId: string }) {
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
          if (result?.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        }}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "جارٍ الإرسال..." : "تم الإنجاز"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
