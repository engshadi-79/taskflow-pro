import Link from "next/link";
import {
  BellIcon,
  BoardIcon,
  ChartIcon,
  CheckSquareIcon,
  FolderIcon,
  UserIcon,
  UsersIcon,
} from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

type Shortcut = { href: string; label: string; tint: string; icon: React.ReactNode };

const ALL: Record<string, Shortcut> = {
  tasks: {
    href: "/dashboard/tasks",
    label: "المهام",
    tint: "bg-brand-blue-50 text-brand-blue-600",
    icon: <CheckSquareIcon className="h-[22px] w-[22px]" />,
  },
  kanban: {
    href: "/dashboard/kanban",
    label: "لوحة كانبان",
    tint: "bg-purple-50 text-purple-500",
    icon: <BoardIcon className="h-[22px] w-[22px]" />,
  },
  employees: {
    href: "/dashboard/employees",
    label: "الفريق",
    tint: "bg-teal-50 text-teal-500",
    icon: <UsersIcon className="h-[22px] w-[22px]" />,
  },
  departments: {
    href: "/dashboard/departments",
    label: "الأقسام",
    tint: "bg-orange-50 text-orange-600",
    icon: <FolderIcon className="h-[22px] w-[22px]" />,
  },
  reports: {
    href: "/dashboard/reports",
    label: "التقارير",
    tint: "bg-green-50 text-green-500",
    icon: <ChartIcon className="h-[22px] w-[22px]" />,
  },
  notifications: {
    href: "/dashboard/notifications",
    label: "الإشعارات",
    tint: "bg-pink-50 text-pink-500",
    icon: <BellIcon className="h-[22px] w-[22px]" />,
  },
  profile: {
    href: "/dashboard/profile",
    label: "الملف الشخصي",
    tint: "bg-accent-50 text-accent-600",
    icon: <UserIcon className="h-[22px] w-[22px]" />,
  },
};

const BY_ROLE: Record<Role, string[]> = {
  super_admin: [
    "tasks",
    "kanban",
    "employees",
    "departments",
    "reports",
    "notifications",
    "profile",
  ],
  department_manager: [
    "tasks",
    "kanban",
    "employees",
    "reports",
    "notifications",
    "profile",
  ],
  employee: ["kanban", "notifications", "profile"],
};

export function QuickShortcuts({ role }: { role: Role }) {
  const items = BY_ROLE[role].map((k) => ALL[k]);

  return (
    <section className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z" />
          </svg>
        </span>
        <h2 className="text-[14.5px] font-extrabold text-foreground">
          اختصارات سريعة
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col items-center gap-2.5 rounded-[14px] border border-border bg-surface px-2 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tint}`}
            >
              {s.icon}
            </span>
            <span className="text-[12.5px] font-bold text-foreground">
              {s.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
