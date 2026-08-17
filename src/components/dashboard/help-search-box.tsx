"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/actions/help-center";
import { CATEGORY_ICON_MAP } from "@/lib/knowledge/category-style";
import { SearchIcon } from "@/components/shared/icons";

export function HelpSearchBox({
  categoryIconByCategory,
}: {
  /** category id -> icon key, so a suggestion row can show the right icon without another round trip. */
  categoryIconByCategory: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await getSearchSuggestions(value);
      setSuggestions(results);
      setOpen(true);
    }, 250);
  }

  function submitSearch() {
    if (!query.trim()) return;
    router.push(`/dashboard/help/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-2 rounded-[16px] bg-white p-1.5 shadow-lg">
        <SearchIcon className="ms-3 h-[18px] w-[18px] shrink-0 text-faint" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitSearch()}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="ابحث عن... (مثال: إنشاء مهمة، إضافة موظف، التقارير)"
          className="min-w-0 flex-1 border-none bg-transparent px-1 py-2.5 text-[14px] text-[#1E1B3A] outline-none placeholder:text-[#8B87A8]"
        />
        <button
          type="button"
          onClick={submitSearch}
          className="shrink-0 rounded-[11px] bg-accent-500 px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:bg-accent-600"
        >
          بحث
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[14px] border border-border bg-surface shadow-xl">
          {suggestions.map((s) => {
            const Icon = CATEGORY_ICON_MAP[categoryIconByCategory[s.category]];
            return (
              <a
                key={s.id}
                href={`/dashboard/knowledge/${s.id}`}
                className="flex items-center gap-2.5 border-b border-border px-4 py-3 text-[13.5px] text-muted last:border-b-0 hover:bg-background hover:text-foreground"
              >
                {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-600" />}
                <span className="truncate">{s.title}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
