"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/actions/projects";

export function ProjectDeleteButton({ projectId }: { projectId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm("حذف هذا المشروع نهائيًا؟ سيبقى مرتبطًا به مهامه ما لم تُحذف بشكل منفصل.")) return;
          setPending(true);
          setError(null);
          const result = await deleteProject(projectId);
          setPending(false);
          if (result.error) setError(result.error);
          else router.refresh();
        }}
        className="text-[12.5px] font-bold text-brand-red-500 hover:underline disabled:opacity-60"
      >
        حذف
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
