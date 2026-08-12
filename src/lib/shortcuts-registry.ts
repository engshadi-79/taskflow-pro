import {
  AlertIcon,
  BellIcon,
  BoardIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartIcon,
  CheckSquareIcon,
  ClockIcon,
  ExternalLinkIcon,
  FolderIcon,
  GearIcon,
  GridIcon,
  UserIcon,
  UsersIcon,
} from "@/components/shared/icons";

export type IconKey =
  | "grid"
  | "tasks"
  | "board"
  | "briefcase"
  | "calendar"
  | "folder"
  | "users"
  | "chart"
  | "clock"
  | "alert"
  | "gear"
  | "bell"
  | "user"
  | "external";

export const ICON_REGISTRY: Record<IconKey, (p: { className?: string }) => React.ReactElement> = {
  grid: GridIcon,
  tasks: CheckSquareIcon,
  board: BoardIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  folder: FolderIcon,
  users: UsersIcon,
  chart: ChartIcon,
  clock: ClockIcon,
  alert: AlertIcon,
  gear: GearIcon,
  bell: BellIcon,
  user: UserIcon,
  external: ExternalLinkIcon,
};

export const TINT: Record<IconKey, string> = {
  grid: "bg-accent-50 text-accent-600",
  tasks: "bg-brand-blue-50 text-brand-blue-600",
  board: "bg-purple-50 text-purple-500",
  briefcase: "bg-pink-50 text-pink-500",
  calendar: "bg-orange-50 text-orange-600",
  folder: "bg-teal-50 text-teal-500",
  users: "bg-teal-50 text-teal-500",
  chart: "bg-green-50 text-green-500",
  clock: "bg-orange-50 text-orange-600",
  alert: "bg-brand-red-50 text-brand-red-500",
  gear: "bg-purple-50 text-purple-500",
  bell: "bg-pink-50 text-pink-500",
  user: "bg-accent-50 text-accent-600",
  external: "bg-background text-muted",
};

/** Solid per-tile hover fill, same color family as TINT - a different
 * color per shortcut, not one shared hover state for all of them. */
export const HOVER_TINT: Record<IconKey, string> = {
  grid: "hover:bg-accent-500",
  tasks: "hover:bg-brand-blue-500",
  board: "hover:bg-purple-500",
  briefcase: "hover:bg-pink-500",
  calendar: "hover:bg-orange-500",
  folder: "hover:bg-teal-500",
  users: "hover:bg-teal-500",
  chart: "hover:bg-green-500",
  clock: "hover:bg-orange-500",
  alert: "hover:bg-brand-red-500",
  gear: "hover:bg-purple-500",
  bell: "hover:bg-pink-500",
  user: "hover:bg-accent-500",
  external: "hover:bg-muted",
};

export type ShortcutItem = { id: string; href: string; label: string; iconKey: IconKey };

/** Every internal page a user is allowed to pin as a shortcut - mirrors the
 * sidebar's own nav registry (src/components/dashboard/sidebar.tsx) so the
 * picker never drifts out of sync with what routes actually exist. */
export const AVAILABLE_PAGES: ShortcutItem[] = [
  { id: "dashboard", href: "/dashboard", label: "لوحة التحكم", iconKey: "grid" },
  { id: "tasks", href: "/dashboard/tasks", label: "المهام", iconKey: "tasks" },
  { id: "kanban", href: "/dashboard/kanban", label: "لوحة كانبان", iconKey: "board" },
  { id: "projects", href: "/dashboard/projects", label: "المشاريع", iconKey: "briefcase" },
  { id: "calendar", href: "/dashboard/calendar", label: "التقويم", iconKey: "calendar" },
  { id: "meetings", href: "/dashboard/meetings", label: "الاجتماعات", iconKey: "calendar" },
  { id: "knowledge", href: "/dashboard/knowledge", label: "قاعدة المعرفة", iconKey: "folder" },
  { id: "employees", href: "/dashboard/employees", label: "الفريق", iconKey: "users" },
  { id: "departments", href: "/dashboard/departments", label: "الأقسام", iconKey: "folder" },
  { id: "reports", href: "/dashboard/reports", label: "التقارير", iconKey: "chart" },
  { id: "workload", href: "/dashboard/workload", label: "الحمل الوظيفي", iconKey: "chart" },
  { id: "time-tracking", href: "/dashboard/time-tracking", label: "سجلّ الوقت", iconKey: "clock" },
  { id: "sla-report", href: "/dashboard/sla-report", label: "تقرير SLA", iconKey: "alert" },
  { id: "sla-policies", href: "/dashboard/sla-policies", label: "سياسات SLA", iconKey: "gear" },
  { id: "workflow-requests", href: "/dashboard/workflow-requests", label: "الطلبات", iconKey: "folder" },
  { id: "workflow-templates", href: "/dashboard/workflow-templates", label: "أنواع الطلبات", iconKey: "gear" },
  { id: "automation-rules", href: "/dashboard/automation-rules", label: "الأتمتة", iconKey: "board" },
  { id: "profile", href: "/dashboard/profile", label: "الملف الشخصي", iconKey: "user" },
  { id: "notifications", href: "/dashboard/notifications", label: "الإشعارات", iconKey: "bell" },
];

export const DEFAULT_SHORTCUTS_BY_ROLE: Record<string, string[]> = {
  super_admin: ["tasks", "kanban", "employees", "departments", "reports", "notifications", "profile"],
  department_manager: ["tasks", "kanban", "employees", "reports", "notifications", "profile"],
  employee: ["kanban", "notifications", "profile"],
};

export const MAX_SHORTCUTS = 12;

/** `saved` is the user's own dashboard_shortcuts column - null means they
 * never customized it, so fall back to the role-based default list. */
export function resolveShortcuts(
  role: string,
  saved: { id: string; href: string; label: string; iconKey: string }[] | null
): ShortcutItem[] {
  if (saved) {
    return saved.map((s) => ({
      ...s,
      iconKey: (s.iconKey in ICON_REGISTRY ? s.iconKey : "external") as IconKey,
    }));
  }
  const keys = DEFAULT_SHORTCUTS_BY_ROLE[role] ?? [];
  return keys
    .map((key) => AVAILABLE_PAGES.find((p) => p.id === key))
    .filter((p): p is ShortcutItem => Boolean(p));
}
