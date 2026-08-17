"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/actions/help-center";
import { BookIcon, CloseIcon, HelpIcon, SearchIcon } from "@/components/shared/icons";

/** A quick-search popup for the help center, opened from the topbar's help icon. */
export function HelpQuickAccessButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function openModal() {
    setQuery("");
    setSuggestions([]);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await getSearchSuggestions(value);
      setSuggestions(results);
    }, 250);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="مركز المساعدة"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition-colors hover:brightness-95"
      >
        <HelpIcon className="h-[19px] w-[19px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} aria-hidden />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="بحث سريع في مركز المساعدة"
            className="relative w-full max-w-[560px] overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl"
          >
            <div className="banner-teal flex items-center justify-between gap-2 px-4 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-black">مركز المساعدة - بحث سريع</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <HelpIcon className="h-4 w-4" />
                </span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="إغلاق"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 rounded-[12px] border border-border bg-background px-3.5 py-2.5 focus-within:border-accent-500">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim()) {
                      closeModal();
                      router.push(`/dashboard/help/search?q=${encodeURIComponent(query.trim())}`);
                    }
                  }}
                  placeholder="ابحث عن... (مثال: إنشاء مهمة، إضافة موظف)"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-faint"
                />
                <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
              </div>

              <div className="mt-3 max-h-[300px] overflow-y-auto">
                {suggestions.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-faint">اكتب للبحث عن موضوع المساعدة...</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {suggestions.map((s) => (
                      <Link
                        key={s.id}
                        href={`/dashboard/knowledge/${s.id}`}
                        onClick={closeModal}
                        className="block truncate rounded-[10px] px-3 py-2.5 text-[13.5px] font-bold text-muted hover:bg-background hover:text-foreground"
                      >
                        {s.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-border bg-surface px-4 py-2 text-[12.5px] font-bold text-muted hover:bg-background"
              >
                إغلاق
              </button>
              <Link
                href="/dashboard/help"
                onClick={closeModal}
                className="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[12.5px] font-extrabold text-white transition-colors hover:bg-accent-600"
              >
                <BookIcon className="h-3.5 w-3.5" /> فتح مركز المساعدة الكامل
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
