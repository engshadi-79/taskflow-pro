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

export function Sidebar({ role }: { role: Role }) {
  const sections = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  return (
    <aside className="sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col overflow-hidden bg-sidebar">
      <AnimatedBackground intensity="subtle" />

      <div className="relative flex items-center gap-2.5 px-5 pb-3 pt-5 text-lg font-black text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent-500 to-purple-500 text-sm text-white shadow-lg shadow-accent-500/30">
          م
        </span>
        نظام منجز
      </div>

      <div className="relative px-4 pb-2">
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
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 pb-5">
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-[13px] text-sidebar-muted">
            لا توجد نتائج مطابقة
          </p>
        )}

        {visible.map((section) => {
          const isCollapsed = collapsed[section.label] && !query;
          return (
            <div key={section.label} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({
                    ...c,
                    [section.label]: !c[section.label],
                  }))
                }
                aria-expanded={!isCollapsed}
                className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-extrabold tracking-wide text-sidebar-muted hover:text-sidebar-fg"
              >
                {section.label}
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {!isCollapsed &&
                section.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isItemActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`mb-0.5 flex items-center gap-3 rounded-[11px] px-2.5 py-2.5 text-[13.5px] font-bold transition-colors ${
                        active
                          ? "bg-gradient-to-l from-accent-600 to-purple-500 text-white shadow-lg shadow-accent-600/25"
                          : "text-sidebar-fg/80 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${
                          active
                            ? "bg-white/20 text-white"
                            : `bg-white/[0.06] ${TONE_FG[item.tone]}`
                        }`}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            BADGE_CLASS[item.badge.tone]
                          }`}
                        >
                          {item.badge.text}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
