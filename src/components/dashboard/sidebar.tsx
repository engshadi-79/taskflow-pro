"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedBackground } from "@/components/shared/animated-background";
import {
  AlertIcon,
  BellIcon,
  BoardIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartIcon,
  CheckCircleIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  FolderIcon,
  GearIcon,
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
  | "bell"
  | "briefcase"
  | "clock"
  | "alert"
  | "gear"
  | "calendar"
  | "check";

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
  briefcase: BriefcaseIcon,
  clock: ClockIcon,
  alert: AlertIcon,
  gear: GearIcon,
  calendar: CalendarIcon,
  check: CheckCircleIcon,
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
const PROJECTS: NavItem = {
  href: "/dashboard/projects",
  label: "المشاريع",
  icon: "briefcase",
  tone: "pink",
};
const CALENDAR: NavItem = {
  href: "/dashboard/calendar",
  label: "التقويم",
  icon: "calendar",
  tone: "violet",
};
const MEETINGS: NavItem = {
  href: "/dashboard/meetings",
  label: "الاجتماعات",
  icon: "calendar",
  tone: "amber",
};
const KNOWLEDGE: NavItem = {
  href: "/dashboard/knowledge",
  label: "قاعدة المعرفة",
  icon: "folder",
  tone: "green",
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
const DECISIONS: NavItem = {
  href: "/dashboard/decisions",
  label: "مركز القرار",
  icon: "alert",
  tone: "indigo",
};
const WORKLOAD: NavItem = {
  href: "/dashboard/workload",
  label: "الحمل الوظيفي",
  icon: "chart",
  tone: "indigo",
};
const TIME_TRACKING: NavItem = {
  href: "/dashboard/time-tracking",
  label: "سجلّ الوقت",
  icon: "clock",
  tone: "amber",
};
const PERFORMANCE: NavItem = {
  href: "/dashboard/performance",
  label: "الأداء والمؤشرات",
  icon: "chart",
  tone: "pink",
};
const SLA_REPORT: NavItem = {
  href: "/dashboard/sla-report",
  label: "تقرير SLA",
  icon: "alert",
  tone: "blue",
};
const SLA_POLICIES: NavItem = {
  href: "/dashboard/sla-policies",
  label: "سياسات SLA",
  icon: "gear",
  tone: "violet",
};
const WORKFLOW_REQUESTS: NavItem = {
  href: "/dashboard/workflow-requests",
  label: "الطلبات",
  icon: "folder",
  tone: "green",
};
const APPROVALS: NavItem = {
  href: "/dashboard/approvals",
  label: "مركز الموافقات",
  icon: "check",
  tone: "blue",
};
const WORKFLOW_TEMPLATES: NavItem = {
  href: "/dashboard/workflow-templates",
  label: "أنواع الطلبات",
  icon: "gear",
  tone: "amber",
};
const AUTOMATION_RULES: NavItem = {
  href: "/dashboard/automation-rules",
  label: "الأتمتة",
  icon: "board",
  tone: "teal",
};
const WORKFLOW_BUILDER: NavItem = {
  href: "/dashboard/workflow-builder",
  label: "باني سير العمل",
  icon: "board",
  tone: "violet",
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
const ADMIN_NOTIFICATIONS: NavItem = {
  href: "/dashboard/admin-notifications",
  label: "الإشعارات الإدارية",
  icon: "alert",
  tone: "amber",
};
const ORG_SETTINGS: NavItem = {
  href: "/dashboard/settings",
  label: "إعدادات المؤسسة",
  icon: "gear",
  tone: "indigo",
};

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  super_admin: [
    { label: "التنقل", items: [DASHBOARD] },
    {
      label: "إدارة العمل",
      items: [
        TASKS,
        KANBAN,
        CALENDAR,
        MEETINGS,
        KNOWLEDGE,
        PROJECTS,
        TEAM,
        DEPARTMENTS,
        REPORTS,
        DECISIONS,
        WORKLOAD,
        TIME_TRACKING,
        SLA_REPORT,
        SLA_POLICIES,
        WORKFLOW_REQUESTS,
        APPROVALS,
        PERFORMANCE,
        WORKFLOW_TEMPLATES,
        AUTOMATION_RULES,
        WORKFLOW_BUILDER,
      ],
    },
    { label: "المستخدمون", items: [PROFILE, NOTIFICATIONS, ADMIN_NOTIFICATIONS, ORG_SETTINGS] },
  ],
  department_manager: [
    { label: "التنقل", items: [DASHBOARD] },
    {
      label: "إدارة العمل",
      items: [
        TASKS,
        KANBAN,
        CALENDAR,
        MEETINGS,
        KNOWLEDGE,
        PROJECTS,
        TEAM,
        REPORTS,
        DECISIONS,
        WORKLOAD,
        TIME_TRACKING,
        SLA_REPORT,
        WORKFLOW_REQUESTS,
        APPROVALS,
        PERFORMANCE,
      ],
    },
    { label: "المستخدمون", items: [PROFILE, NOTIFICATIONS, ADMIN_NOTIFICATIONS] },
  ],
  employee: [
    { label: "التنقل", items: [{ ...DASHBOARD, label: "مهامي" }] },
    { label: "إدارة العمل", items: [KANBAN, CALENDAR, MEETINGS, KNOWLEDGE, PROJECTS, WORKFLOW_REQUESTS, PERFORMANCE] },
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

export function Sidebar({
  role,
  logoUrl,
  mobileOpen = false,
  onMobileClose,
}: {
  role: Role;
  /** The organization's uploaded logo (Settings > الهوية) - falls back to
   * the static "م" mark below when none is set. */
  logoUrl?: string | null;
  /** Controls the <md drawer only - the lg hover-expand rail below is
   * unaffected and keeps managing its own `open` state independently. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const sections = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  // the mobile drawer always shows full labels/search, regardless of hover
  const effectiveOpen = open || mobileOpen;

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
      {/* Holds the rail's place only while it is overlaid (md-lg only - below
          md the rail is a hidden-by-default drawer, so no space is reserved). */}
      <div className="hidden shrink-0 md:block lg:hidden" style={{ width: RAIL }} aria-hidden />

      {/* Backdrop for the <md drawer - tapping it closes the sidebar, same
          as the close button inside. Never rendered at md+. */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        // keyboard users get the same expansion when focus enters the rail
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
        }}
        style={{ width: effectiveOpen ? PANEL : RAIL }}
        /* From lg up the rail sits in flow, so expanding narrows the content
           column. Below lg there is not enough room to give away - pushing
           would squeeze the page to ~79px at 375px - so it overlays instead.
           Below md it is fully hidden (translate-x-full) until mobileOpen -
           dir="rtl" on <html> puts this aside on the visual right edge
           (inset-start-0), so sliding it further along +x moves it off the
           right side, i.e. the slide-in direction is from the right. */
        className={`fixed inset-y-0 start-0 z-40 flex h-dvh flex-col overflow-hidden bg-sidebar transition-[width,transform] duration-300 ease-out motion-reduce:transition-none lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:shrink-0 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } ${effectiveOpen ? "shadow-2xl shadow-black/40 lg:shadow-none" : ""}`}
      >
        <AnimatedBackground intensity="subtle" />

        {/* same height as the topbar, so the two form one unbroken top strip.
            px-[22px] centres the 32px mark inside the 76px rail. */}
        <div className="relative flex h-[70px] shrink-0 items-center gap-2.5 border-b border-white/10 px-[22px] text-lg font-black text-white">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-[10px] object-cover shadow-lg shadow-accent-500/30"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent-500 to-purple-500 text-sm text-white shadow-lg shadow-accent-500/30">
              م
            </span>
          )}
          {effectiveOpen && <span className="whitespace-nowrap">نظام منجز</span>}
          {/* only meaningful for the <md drawer - md+ never sets mobileOpen */}
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="إغلاق القائمة"
            className="ms-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Collapsed and expanded states occupy identical heights throughout,
            so nothing drifts vertically while the width animates. */}
        <div className="relative px-3 pb-2 pt-4">
          {effectiveOpen ? (
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
          {effectiveOpen && visible.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-sidebar-muted">
              لا توجد نتائج مطابقة
            </p>
          )}

          {visible.map((section) => {
            const isCollapsed = collapsed[section.label] && !query;
            return (
              <div key={section.label} className="mb-1">
                {effectiveOpen ? (
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

                {(effectiveOpen ? !isCollapsed : true) &&
                  section.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = isItemActive(item.href, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onMobileClose}
                        aria-current={active ? "page" : undefined}
                        // the label is not rendered while collapsed, so the
                        // accessible name has to come from the attribute
                        aria-label={effectiveOpen ? undefined : item.label}
                        title={effectiveOpen ? undefined : item.label}
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
                        {effectiveOpen && (
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
