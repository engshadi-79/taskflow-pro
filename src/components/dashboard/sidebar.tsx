"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedBackground } from "@/components/shared/animated-background";
import {
  BellIcon,
  BoardIcon,
  ChartIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  FolderIcon,
  GridIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

type IconKey =
  | "grid"
  | "tasks"
  | "board"
  | "users"
  | "folder"
  | "chart"
  | "user"
  | "bell";

type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  tone: Tone;
  badge?: { text: string; tone: "amber" | "red" };
};
type NavSection = { label: string; items: NavItem[] };

type Tone = "indigo" | "teal" | "violet" | "amber" | "pink" | "green" | "blue";

const ICONS: Record<IconKey, (p: { className?: string }) => React.ReactElement> = {
  grid: GridIcon,
  tasks: CheckSquareIcon,
  board: BoardIcon,
  users: UsersIcon,
  folder: FolderIcon,
  chart: ChartIcon,
  user: UserIcon,
  bell: BellIcon,
};

// Icon colours on the dark rail, mirroring the ACAS portal's multi-hue nav.
const TONE_FG: Record<Tone, string> = {
  indigo: "text-indigo-400",
  teal: "text-teal-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  pink: "text-pink-400",
  green: "text-emerald-400",
  blue: "text-sky-400",
};

const BADGE_CLASS = {
  amber: "bg-amber-400/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
} as const;

const DASHBOARD: NavItem = {
  href: "/dashboard",
  label: "لوحة التحكم",
  icon: "grid",
  tone: "indigo",
};

const TASKS: NavItem = {
  href: "/dashboard/tasks",
  label: "المهام",
  icon: "tasks",
  tone: "blue",
};
const KANBAN: NavItem = {
  href: "/dashboard/kanban",
  label: "لوحة كانبان",
  icon: "board",
  tone: "violet",
};
const TEAM: NavItem = {
  href: "/dashboard/employees",
  label: "الفريق",
  icon: "users",
  tone: "teal",
};
const DEPARTMENTS: NavItem = {
  href: "/dashboard/departments",
  label: "الأقسام",
  icon: "folder",
  tone: "amber",
};
const REPORTS: NavItem = {
  href: "/dashboard/reports",
  label: "التقارير",
  icon: "chart",
  tone: "green",
};
const PROFILE: NavItem = {
  href: "/dashboard/profile",
  label: "الملف الشخصي",
  icon: "user",
  tone: "indigo",
};
const NOTIFICATIONS: NavItem = {
  href: "/dashboard/notifications",
  label: "الإشعارات",
  icon: "bell",
  tone: "pink",
};

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  super_admin: [
    { label: "التنقل", items: [DASHBOARD] },
    {
      label: "إدارة العمل",
      items: [TASKS, KANBAN, TEAM, DEPARTMENTS, REPORTS],
    },
    { label: "المستخدمون", items: [PROFILE, NOTIFICATIONS] },
  ],
  department_manager: [
    { label: "التنقل", items: [DASHBOARD] },
    { label: "إدارة العمل", items: [TASKS, KANBAN, TEAM, REPORTS] },
    { label: "المستخدمون", items: [PROFILE, NOTIFICATIONS] },
  ],
  employee: [
    { label: "التنقل", items: [{ ...DASHBOARD, label: "مهامي" }] },
    { label: "إدارة العمل", items: [KANBAN] },
    { label: "المستخدمون", items: [PROFILE, NOTIFICATIONS] },
  ],
};

function isItemActive(href: string, pathname: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

const RAIL = 76;
const PANEL = 248;

export function Sidebar({ role }: { role: Role }) {
  const sections = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.label.includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, sections]);

  function close() {
    setOpen(false);
    // a filter left applied while collapsed would silently hide nav items
    setQuery("");
  }

  return (
    <>
      {/* Holds the rail's place only while it is overlaid (below lg). */}
      <div className="shrink-0 lg:hidden" style={{ width: RAIL }} aria-hidden />

      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        // keyboard users get the same expansion when focus enters the rail
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
        }}
        style={{ width: open ? PANEL : RAIL }}
        /* From lg up the rail sits in flow, so expanding narrows the content
           column. Below lg there is not enough room to give away - pushing
           would squeeze the page to ~79px at 375px - so it overlays instead. */
        className={`fixed inset-y-0 start-0 z-30 flex h-dvh flex-col overflow-hidden bg-sidebar transition-[width] duration-300 ease-out lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:shrink-0 motion-reduce:transition-none ${
          open ? "shadow-2xl shadow-black/40 lg:shadow-none" : ""
        }`}
      >
        <AnimatedBackground intensity="subtle" />

        {/* same height as the topbar, so the two form one unbroken top strip.
            px-[22px] centres the 32px mark inside the 76px rail. */}
        <div className="relative flex h-[70px] shrink-0 items-center gap-2.5 border-b border-white/10 px-[22px] text-lg font-black text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent-500 to-purple-500 text-sm text-white shadow-lg shadow-accent-500/30">
            م
          </span>
          {open && <span className="whitespace-nowrap">نظام منجز</span>}
        </div>

        {/* Collapsed and expanded states occupy identical heights throughout,
            so nothing drifts vertically while the width animates. */}
        <div className="relative px-3 pb-2 pt-4">
          {open ? (
            <label className="relative block">
              <span className="sr-only">بحث في القائمة</span>
              <SearchIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث في القائمة..."
                className="w-full rounded-[10px] border border-white/10 bg-white/5 py-2 pe-9 ps-3 text-[13px] text-sidebar-fg outline-none placeholder:text-sidebar-muted focus:border-accent-500/60 focus:bg-white/10"
              />
            </label>
          ) : (
            <div
              aria-hidden
              className="flex h-[38px] items-center justify-center rounded-[10px] border border-white/10 bg-white/5"
            >
              <SearchIcon className="h-4 w-4 text-sidebar-muted" />
            </div>
          )}
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-5">
          {open && visible.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-sidebar-muted">
              لا توجد نتائج مطابقة
            </p>
          )}

          {visible.map((section) => {
            const isCollapsed = collapsed[section.label] && !query;
            return (
              <div key={section.label} className="mb-1">
                {open ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({
                        ...c,
                        [section.label]: !c[section.label],
                      }))
                    }
                    aria-expanded={!isCollapsed}
                    className="mb-1 flex h-[30px] w-full items-center justify-between rounded-lg px-3 text-[11px] font-extrabold tracking-wide text-sidebar-muted hover:text-sidebar-fg"
                  >
                    <span className="whitespace-nowrap">{section.label}</span>
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <div
                    aria-hidden
                    className="mb-1 flex h-[30px] items-center justify-center"
                  >
                    <span className="h-px w-6 rounded bg-white/10" />
                  </div>
                )}

                {(open ? !isCollapsed : true) &&
                  section.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = isItemActive(item.href, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        // the label is not rendered while collapsed, so the
                        // accessible name has to come from the attribute
                        aria-label={open ? undefined : item.label}
                        title={open ? undefined : item.label}
                        className={`mb-0.5 flex items-center gap-3 rounded-[11px] px-[6px] py-1.5 text-[13.5px] font-bold transition-colors ${
                          active
                            ? "bg-gradient-to-l from-accent-600 to-purple-500 text-white shadow-lg shadow-accent-600/25"
                            : "text-sidebar-fg/80 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                            active
                              ? "bg-white/20 text-white"
                              : `bg-white/[0.06] ${TONE_FG[item.tone]}`
                          }`}
                        >
                          <Icon className="h-[19px] w-[19px]" />
                        </span>
                        {open && (
                          <>
                            <span className="flex-1 truncate whitespace-nowrap">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  BADGE_CLASS[item.badge.tone]
                                }`}
                              >
                                {item.badge.text}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
