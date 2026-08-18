"use client";

import { useState } from "react";
import { upsertDailyCheck } from "@/lib/actions/inventory";
import type { InventoryDailyCheck, InventoryTool } from "@/lib/types/inventory";

export function InventoryDailyRow({
  tool,
  check,
  date,
  editable,
}: {
  tool: InventoryTool;
  check: InventoryDailyCheck | null;
  date: string;
  editable: boolean;
}) {
  const [morning, setMorning] = useState(check?.morning_quantity ?? "");
  const [evening, setEvening] = useState(check?.evening_quantity ?? "");
  const [actual, setActual] = useState(check?.actual_quantity ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-24 rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500 disabled:opacity-60";

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await upsertDailyCheck(tool.id, date, { morning, evening, actual });
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <tr className="border-t border-border transition-colors hover:bg-background">
      <td className="px-2 py-2.5 font-medium text-foreground">
        {tool.name}
        {tool.unit && <span className="ms-1 text-[11px] text-faint">({tool.unit})</span>}
      </td>
      <td className="px-2 py-2.5 text-muted">{tool.total_quantity ?? "—"}</td>
      <td className="px-2 py-2.5">
        <input
          value={morning}
          onChange={(e) => setMorning(e.target.value)}
          disabled={!editable}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2.5">
        <input
          value={evening}
          onChange={(e) => setEvening(e.target.value)}
          disabled={!editable}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2.5">
        <input
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          disabled={!editable}
          className={inputClass}
        />
      </td>
      {editable && (
        <td className="px-2 py-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="rounded-full bg-accent-500 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? "..." : "حفظ"}
          </button>
          {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
        </td>
      )}
    </tr>
  );
}
