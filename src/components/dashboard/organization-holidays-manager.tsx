"use client";

import { useState } from "react";
import { addOrganizationHoliday, deleteOrganizationHoliday } from "@/lib/actions/organization-settings";
import { CloseIcon, PlusIcon } from "@/components/shared/icons";
import type { OrganizationHoliday } from "@/lib/types/organization";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function OrganizationHolidaysManager({ holidays }: { holidays: OrganizationHoliday[] }) {
  const [items, setItems] = useState(
    [...holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("اسم العطلة مطلوب");
      return;
    }
    if (!date) {
      setError("تاريخ العطلة مطلوب");
      return;
    }
    setPending(true);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("holiday_date", date);
    const result = await addOrganizationHoliday({}, fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) =>
      [...prev, { id: crypto.randomUUID(), organization_id: "", holiday_date: date, name: name.trim(), created_at: new Date().toISOString() }].sort(
        (a, b) => a.holiday_date.localeCompare(b.holiday_date)
      )
    );
    setName("");
    setDate("");
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteOrganizationHoliday(id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13.5px] font-extrabold text-foreground">أيام العطل الرسمية</h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            إضافة عطلة
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {adding && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-background p-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-muted">التاريخ</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-[11.5px] text-muted">اسم العطلة</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={handleAdd}
            className="rounded-md bg-accent-500 px-3 py-2 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName("");
              setDate("");
            }}
            className="rounded-md border border-border px-3 py-2 text-[12.5px] text-foreground hover:bg-background"
          >
            إلغاء
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted">لا توجد عطلات مسجّلة</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] hover:bg-background">
              <span className="font-semibold text-foreground">{h.name}</span>
              <span className="flex items-center gap-2 text-muted">
                {new Date(h.holiday_date).toLocaleDateString("ar")}
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  aria-label="حذف العطلة"
                  className="rounded-full p-1 text-faint hover:bg-surface hover:text-red-600"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
