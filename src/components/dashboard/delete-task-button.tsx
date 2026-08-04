"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteTask } from "@/lib/actions/tasks";

export function DeleteTaskButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.")) return;
        setPending(true);
        const result = await deleteTask(id);
        setPending(false);
        if (result?.error) {
          alert(result.error);
          return;
        }
        router.push("/dashboard/tasks");
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-60"
    >
      حذف المهمة
    </button>
  );
}
