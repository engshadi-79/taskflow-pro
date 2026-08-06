"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CheckSquareIcon,
  ClockIcon,
  FolderIcon,
  GridIcon,
  SearchIcon,
  UserIcon,
} from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

type Kind = "page" | "task" | "employee" | "department" | "recent";

type Item = {
  id: string;
  kind: Kind;
  label: string;
  hint?: string;
  href: string;
};

const RECENT_QUERIES_KEY = "monjez:recent-queries";
const RECENT_ITEMS_KEY = "monjez:recent-items";
const MAX_RECENT = 5;
const PER_GROUP = 5;
const DEBOUNCE_MS = 220;
const MIN_TERM = 2;

/** Prefix scoping, mirroring the reference palette's `s:` / `e:` hints. */
const PREFIXES: Record<string, Kind> = {
  t: "task",
  e: "employee",
  d: "department",
  p: "page",
};

const KIND_META: Record<Kind, { label: string; tint: string; icon: React.ReactNode }> = {
  page: {
    label: "صفحة",
    tint: "bg-accent-50 text-accent-600",
    icon: <GridIcon className="h-[17px] w-[17px]" />,
  },
  task: {
    label: "مهمة",
    tint: "bg-brand-blue-50 text-brand-blue-600",
    icon: <CheckSquareIcon className="h-[17px] w-[17px]" />,
  },
  employee: {
    label: "موظف",
    tint: "bg-teal-50 text-teal-500",
    icon: <UserIcon className="h-[17px] w-[17px]" />,
  },
  department: {
    label: "قسم",
    tint: "bg-orange-50 text-orange-600",
    icon: <FolderIcon className="h-[17px] w-[17px]" />,
  },
  recent: {
    label: "سابق",
    tint: "bg-background text-muted",
    icon: <ClockIcon className="h-[17px] w-[17px]" />,
  },
};

type PageEntry = { label: string; href: string; roles: Role[] };

const ALL_ROLES: Role[] = ["super_admin", "department_manager", "employee"];

const PAGES: PageEntry[] = [
  { label: "لوحة التحكم", href: "/dashboard", roles: ALL_ROLES },
  { label: "المهام", href: "/dashboard/tasks", roles: ["super_admin", "department_manager"] },
  { label: "مهمة جديدة", href: "/dashboard/tasks/new", roles: ["super_admin", "department_manager"] },
  { label: "لوحة كانبان", href: "/dashboard/kanban", roles: ALL_ROLES },
  { label: "الفريق", href: "/dashboard/employees", roles: ["super_admin", "department_manager"] },
  { label: "الأقسام", href: "/dashboard/departments", roles: ["super_admin"] },
  { label: "التقارير", href: "/dashboard/reports", roles: ["super_admin", "department_manager"] },
  { label: "الإشعارات", href: "/dashboard/notifications", roles: ALL_ROLES },
  { label: "الملف الشخصي", href: "/dashboard/profile", roles: ALL_ROLES },
];

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Keeps an index inside a list that may have shrunk since it was set. */
function clamp(index: number, length: number) {
  return length ? Math.min(index, length - 1) : 0;
}

/** Splits a leading `t:` / `e:` / `d:` / `p:` scope off the query. */
function parseQuery(raw: string) {
  const match = /^([tedp]):\s*(.*)$/i.exec(raw.trim());
  if (match) {
    return { scope: PREFIXES[match[1].toLowerCase()], term: match[2].trim() };
  }
  return { scope: null as Kind | null, term: raw.trim() };
}

export function CommandPalette({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Item[]>([]);
  /** Term the rows in `remote` belong to; also drives the loading state. */
  const [loadedTerm, setLoadedTerm] = useState("");
  const [active, setActive] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [refocus, setRefocus] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const requestId = useRef(0);
  const router = useRouter();

  const { scope, term } = useMemo(() => parseQuery(query), [query]);
  const searchable = term.length >= MIN_TERM;

  const openPalette = useCallback(() => {
    setRecentQueries(readList<string>(RECENT_QUERIES_KEY));
    setRecentItems(readList<Item>(RECENT_ITEMS_KEY));
    setQuery("");
    setRemote([]);
    setLoadedTerm("");
    setActive(0);
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemote([]);
    setLoadedTerm("");
    setActive(0);
  }, []);

  // open with Ctrl/Cmd+K from anywhere
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette, closePalette]);

  // focus and scroll lock only; state is set by the open/close handlers
  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      const prev = restoreRef.current;
      if (prev?.isConnected) prev.focus();
    };
  }, [open]);

  // return focus to the field after a past query is re-applied by mouse
  useEffect(() => {
    if (refocus) inputRef.current?.focus();
  }, [refocus]);

  // debounced, RLS-scoped lookup; stale responses are discarded by id
  useEffect(() => {
    if (!open || !searchable) return;

    const id = ++requestId.current;

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const pattern = `%${term}%`;
      const wanted = (k: Kind) => !scope || scope === k;

      const [tasks, employees, departments] = await Promise.all([
        wanted("task")
          ? supabase.from("tasks").select("id, title").ilike("title", pattern).limit(PER_GROUP)
          : Promise.resolve({ data: null }),
        wanted("employee")
          ? supabase
              .from("users")
              .select("id, full_name, job_title")
              .ilike("full_name", pattern)
              .limit(PER_GROUP)
          : Promise.resolve({ data: null }),
        wanted("department")
          ? supabase.from("departments").select("id, name").ilike("name", pattern).limit(PER_GROUP)
          : Promise.resolve({ data: null }),
      ]);

      if (id !== requestId.current) return; // a newer query already ran

      const next: Item[] = [];
      for (const t of (tasks.data ?? []) as { id: string; title: string }[]) {
        next.push({
          id: `task-${t.id}`,
          kind: "task",
          label: t.title,
          href: `/dashboard/tasks/${t.id}`,
        });
      }
      for (const u of (employees.data ?? []) as {
        id: string;
        full_name: string;
        job_title: string | null;
      }[]) {
        next.push({
          id: `emp-${u.id}`,
          kind: "employee",
          label: u.full_name,
          hint: u.job_title ?? undefined,
          href: `/dashboard/profile/${u.id}`,
        });
      }
      for (const d of (departments.data ?? []) as { id: string; name: string }[]) {
        next.push({
          id: `dep-${d.id}`,
          kind: "department",
          label: d.name,
          href: "/dashboard/departments",
        });
      }

      setRemote(next);
      setLoadedTerm(term);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, term, scope, searchable]);

  const pageResults = useMemo<Item[]>(() => {
    if (scope && scope !== "page") return [];
    const allowed = PAGES.filter((p) => p.roles.includes(role));
    const matched = term ? allowed.filter((p) => p.label.includes(term)) : allowed;
    return matched.map((p) => ({
      id: `page-${p.href}`,
      kind: "page" as const,
      label: p.label,
      href: p.href,
    }));
  }, [role, term, scope]);

  const results = useMemo<Item[]>(() => {
    if (!term) {
      const recents = recentQueries.map((q) => ({
        id: `q-${q}`,
        kind: "recent" as const,
        label: q,
        hint: "اضغط لإعادة البحث",
        href: "",
      }));
      return [...recents, ...recentItems, ...pageResults];
    }
    // only show rows that belong to the term currently in the field
    const fresh = loadedTerm === term ? remote : [];
    return [...pageResults, ...fresh];
  }, [term, recentQueries, recentItems, pageResults, remote, loadedTerm]);

  const loading = searchable && loadedTerm !== term;
  // clamp rather than reset via an effect, so the list shrinking is safe
  const activeIndex = clamp(active, results.length);

  const persist = useCallback(
    (item: Item) => {
      try {
        if (term) {
          const queries = [
            term,
            ...readList<string>(RECENT_QUERIES_KEY).filter((q) => q !== term),
          ].slice(0, MAX_RECENT);
          localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(queries));
        }
        if (item.kind !== "recent" && item.kind !== "page") {
          const items = [
            item,
            ...readList<Item>(RECENT_ITEMS_KEY).filter((i) => i.id !== item.id),
          ].slice(0, MAX_RECENT);
          localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items));
        }
      } catch {
        // storage disabled or full: navigation must still work
      }
    },
    [term]
  );

  const choose = useCallback(
    (item: Item, newTab = false) => {
      // a past query re-runs the search instead of navigating
      if (item.kind === "recent" && !item.href) {
        setQuery(item.label);
        setActive(0);
        setRefocus((n) => n + 1);
        return;
      }
      persist(item);
      if (newTab) {
        window.open(item.href, "_blank", "noopener");
        return;
      }
      closePalette();
      router.push(item.href);
    },
    [persist, router, closePalette]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
      return;
    }
    // functional updates, so two keypresses batched into one render still
    // advance twice instead of both reading the same stale index
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (clamp(i, results.length) + 1) % results.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        results.length
          ? (clamp(i, results.length) - 1 + results.length) % results.length
          : 0
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) choose(item, e.metaKey || e.ctrlKey);
      return;
    }
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const item = results[Number(e.key) - 1];
      if (item) {
        e.preventDefault();
        choose(item);
      }
    }
  }

  // keep the highlighted row in view while arrowing through a long list
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const groups = useMemo(() => {
    const out: { title: string; items: Item[] }[] = [];
    const push = (title: string, items: Item[]) => {
      if (items.length) out.push({ title, items });
    };
    const of = (...kinds: Kind[]) => results.filter((r) => kinds.includes(r.kind));

    if (!term) {
      push("عمليات بحث سابقة", of("recent"));
      push("زرتها مؤخراً", of("task", "employee", "department"));
      push("الصفحات", of("page"));
    } else {
      push("الصفحات", of("page"));
      push("المهام", of("task"));
      push("الموظفون", of("employee"));
      push("الأقسام", of("department"));
    }
    return out;
  }, [results, term]);

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="بحث سريع (Ctrl+K)"
        title="بحث سريع (Ctrl+K)"
        className="hidden h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-colors hover:brightness-95 sm:flex"
      >
        <SearchIcon className="h-[19px] w-[19px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closePalette}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="بحث سريع"
            className="relative flex max-h-[76vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-accent-600" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                aria-activedescendant={
                  results[activeIndex] ? `palette-opt-${activeIndex}` : undefined
                }
                aria-label="بحث سريع"
                placeholder="بحث... (t:مهمة | e:موظف | d:قسم | p:صفحة)"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-faint"
              />
              <button
                type="button"
                onClick={closePalette}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-bold text-muted hover:bg-background"
              >
                ESC
              </button>
            </div>

            <div
              id="palette-list"
              role="listbox"
              aria-label="النتائج"
              ref={listRef}
              className="flex-1 overflow-y-auto"
            >
              {loading && (
                <p className="px-4 py-6 text-center text-[13px] text-muted">
                  جارٍ البحث...
                </p>
              )}

              {!loading && results.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-faint">
                    <SearchIcon className="h-5 w-5" />
                  </span>
                  <p className="text-[13px] text-muted">
                    {term.length > 0 && !searchable
                      ? "اكتب حرفين على الأقل"
                      : "لا توجد نتائج"}
                  </p>
                </div>
              )}

              {!loading &&
                groups.map((group) => (
                  <div key={group.title}>
                    <div className="px-4 pb-1 pt-3 text-[11px] font-extrabold text-faint">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const index = results.indexOf(item);
                      const meta = KIND_META[item.kind];
                      const selected = index === activeIndex;
                      return (
                        <button
                          key={item.id}
                          id={`palette-opt-${index}`}
                          data-index={index}
                          role="option"
                          aria-selected={selected}
                          type="button"
                          onMouseEnter={() => setActive(index)}
                          onClick={(e) => choose(item, e.metaKey || e.ctrlKey)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                            selected ? "bg-accent-50" : "hover:bg-background"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${meta.tint}`}
                          >
                            {meta.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-bold text-foreground">
                              {item.label}
                            </span>
                            <span className="block truncate text-[11.5px] text-muted">
                              {item.hint ?? meta.label}
                            </span>
                          </span>
                          {index < 9 && (
                            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted sm:block">
                              Alt+{index + 1}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[11px] text-muted">
              <Hint keys="Alt + 1-9">فتح سريع</Hint>
              <Hint keys="Ctrl + Enter">تبويب جديد</Hint>
              <Hint keys="Enter">فتح</Hint>
              <Hint keys="↑ ↓">تنقّل</Hint>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Hint({ keys, children }: { keys: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-bold">
        {keys}
      </kbd>
    </span>
  );
}
