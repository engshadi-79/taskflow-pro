"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/shared/modal";
import { CloseIcon, GearIcon, PlusIcon } from "@/components/shared/icons";
import {
  AVAILABLE_PAGES,
  DEFAULT_SHORTCUTS_BY_ROLE,
  HOVER_TINT,
  ICON_REGISTRY,
  MAX_SHORTCUTS,
  TINT,
  type ShortcutItem,
} from "@/lib/shortcuts-registry";
import { updateOwnShortcuts } from "@/lib/actions/shortcuts";
import type { Role } from "@/lib/types/roles";

export function QuickShortcuts({
  role,
  initialShortcuts,
}: {
  role: Role;
  initialShortcuts: ShortcutItem[];
}) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [editing, setEditing] = useState(false);

  return (
    <section className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z" />
            </svg>
          </span>
          <h2 className="text-[14.5px] font-extrabold text-foreground">اختصارات سريعة</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          <GearIcon className="h-3.5 w-3.5" />
          تخصيص
        </button>
      </div>

      {shortcuts.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">لا توجد اختصارات، اضغط &quot;تخصيص&quot; لإضافة بعضها</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {shortcuts.map((s) => {
            const Icon = ICON_REGISTRY[s.iconKey] ?? ICON_REGISTRY.external;
            return (
              <Link
                key={s.id}
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`group flex flex-col items-center gap-2.5 rounded-[14px] border border-border bg-surface px-2 py-4 text-center transition-all duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:border-transparent hover:shadow-lg ${HOVER_TINT[s.iconKey]}`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-white/20 ${TINT[s.iconKey]} group-hover:text-white`}
                >
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="text-[12.5px] font-bold text-foreground transition-colors duration-200 group-hover:text-white">
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {editing && (
        <CustomizeModal
          role={role}
          current={shortcuts}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setShortcuts(next);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

function CustomizeModal({
  role,
  current,
  onClose,
  onSaved,
}: {
  role: Role;
  current: ShortcutItem[];
  onClose: () => void;
  onSaved: (next: ShortcutItem[]) => void;
}) {
  const [draft, setDraft] = useState<ShortcutItem[]>(current);
  const [search, setSearch] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftHrefs = new Set(draft.map((d) => d.href));
  const availableToAdd = AVAILABLE_PAGES.filter(
    (p) => !draftHrefs.has(p.href) && p.label.includes(search.trim())
  );

  function remove(id: string) {
    setDraft((prev) => prev.filter((d) => d.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addPage(page: ShortcutItem) {
    if (draft.length >= MAX_SHORTCUTS) {
      setError(`الحد الأقصى ${MAX_SHORTCUTS} اختصارات`);
      return;
    }
    setDraft((prev) => [...prev, { ...page, id: crypto.randomUUID() }]);
    setError(null);
  }

  function addExternalLink() {
    const url = linkUrl.trim();
    const label = linkLabel.trim();
    if (!url || !label) {
      setError("أدخل الرابط والعنوان معًا");
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    } catch {
      setError("رابط غير صالح");
      return;
    }
    if (draft.length >= MAX_SHORTCUTS) {
      setError(`الحد الأقصى ${MAX_SHORTCUTS} اختصارات`);
      return;
    }
    setDraft((prev) => [...prev, { id: crypto.randomUUID(), href: url, label, iconKey: "external" }]);
    setLinkUrl("");
    setLinkLabel("");
    setError(null);
  }

  function resetToDefault() {
    const keys = DEFAULT_SHORTCUTS_BY_ROLE[role] ?? [];
    setDraft(
      keys
        .map((key) => AVAILABLE_PAGES.find((p) => p.id === key))
        .filter((p): p is ShortcutItem => Boolean(p))
        .map((p) => ({ ...p, id: crypto.randomUUID() }))
    );
    setError(null);
  }

  async function save() {
    setSaving(true);
    const result = await updateOwnShortcuts(draft);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSaved(draft);
  }

  return (
    <Modal title="تخصيص الاختصارات السريعة" subtitle="رتّب، أضف، أو احذف اختصارات لوحة التحكم" onClose={onClose}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        <div>
          <p className="mb-2 text-[12.5px] font-bold text-foreground">الاختصارات المفعّلة</p>
          {draft.length === 0 && <p className="text-sm text-muted">لا توجد اختصارات مضافة بعد</p>}
          <div className="space-y-1.5">
            {draft.map((item, i) => {
              const Icon = ICON_REGISTRY[item.iconKey] ?? ICON_REGISTRY.external;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${TINT[item.iconKey]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-[12.5px] font-bold text-foreground">{item.label}</span>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-surface disabled:opacity-30"
                    aria-label="تحريك لأعلى"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-surface disabled:opacity-30"
                    aria-label="تحريك لأسفل"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label={`إزالة ${item.label}`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-bold text-foreground">متاح للإضافة</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن صفحة..."
            className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
          />
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {availableToAdd.map((page) => {
              const Icon = ICON_REGISTRY[page.iconKey];
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => addPage(page)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12.5px] font-bold text-foreground hover:bg-background"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md ${TINT[page.iconKey]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 truncate">{page.label}</span>
                  <PlusIcon className="h-3.5 w-3.5 text-accent-500" />
                </button>
              );
            })}
            {availableToAdd.length === 0 && (
              <p className="px-2 py-2 text-[12px] text-muted">لا نتائج</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-bold text-foreground">إضافة رابط خارجي</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="العنوان"
              className="w-28 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
              className="w-40 flex-[2] rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
            />
            <button
              type="button"
              onClick={addExternalLink}
              className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              إضافة
            </button>
          </div>
        </div>

        {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={resetToDefault}
          className="rounded-full border border-border px-3 py-1.5 text-[12px] font-bold text-foreground hover:bg-background"
        >
          استعادة الافتراضي
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-full bg-accent-500 px-4 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </Modal>
  );
}
