"use client";

import { useState } from "react";
import { seedGazaEmpowermentDemo } from "@/lib/actions/demo-seed";

export function DemoSeedButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[] | null>(null);

  async function run() {
    if (!confirm("سيتم إنشاء أقسام وموظفين ومشروع ومهام واجتماعات تجريبية في مؤسستك الحالية. متابعة؟")) return;
    setPending(true);
    setError(null);
    const result = await seedGazaEmpowermentDemo();
    setPending(false);
    if (result.error) setError(result.error);
    if (result.summary) setSummary(result.summary);
  }

  return (
    <div className="space-y-4 rounded-[18px] border border-border bg-surface p-6">
      <button
        type="button"
        onClick={run}
        disabled={pending || !!summary}
        className="rounded-[10px] bg-accent-500 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "جارٍ التنفيذ..." : summary ? "تم التنفيذ" : "تنفيذ السيناريو التجريبي"}
      </button>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {summary && (
        <div className="space-y-2 rounded-[12px] bg-background p-4">
          <p className="text-sm font-extrabold text-foreground">تم إنشاء السيناريو بنجاح:</p>
          <ul className="list-inside list-disc space-y-1 text-[13px] text-muted">
            {summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
