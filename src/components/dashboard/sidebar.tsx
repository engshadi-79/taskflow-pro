"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types/roles";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { label: string; items: NavItem[] };

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  super_admin: [
    {
      label: "التنقل",
      items: [{ href: "/dashboard", label: "لوحة التحكم", icon: "▦" }],
    },
    {
      label: "إدارة العمل",
      items: [
        { href: "/dashboard/tasks", label: "المهام", icon: "✓" },
        { href: "/dashboard/kanban", label: "لوحة كانبان", icon: "📋" },
        { href: "/dashboard/employees", label: "الفريق", icon: "👥" },
        { href: "/dashboard/departments", label: "الأقسام", icon: "📁" },
        { href: "/dashboard/reports", label: "التقارير", icon: "📊" },
      ],
    },
    {
      label: "المستخدمون",
      items: [
        { href: "/dashboard/profile", label: "الملف الشخصي", icon: "👤" },
        { href: "/dashboard/notifications", label: "الإشعارات", icon: "🔔" },
      ],
    },
  ],
  department_manager: [
    {
      label: "التنقل",
      items: [{ href: "/dashboard", label: "لوحة التحكم", icon: "▦" }],
    },
    {
      label: "إدارة العمل",
      items: [
        { href: "/dashboard/tasks", label: "المهام", icon: "✓" },
        { href: "/dashboard/kanban", label: "لوحة كانبان", icon: "📋" },
        { href: "/dashboard/employees", label: "الفريق", icon: "👥" },
        { href: "/dashboard/reports", label: "التقارير", icon: "📊" },
      ],
    },
    {
      label: "المستخدمون",
      items: [
        { href: "/dashboard/profile", label: "الملف الشخصي", icon: "👤" },
        { href: "/dashboard/notifications", label: "الإشعارات", icon: "🔔" },
      ],
    },
  ],
  employee: [
    {
      label: "التنقل",
      items: [{ href: "/dashboard", label: "مهامي", icon: "▦" }],
    },
    {
      label: "إدارة العمل",
      items: [{ href: "/dashboard/kanban", label: "لوحة كانبان", icon: "📋" }],
    },
    {
      label: "المستخدمون",
      items: [
        { href: "/dashboard/profile", label: "الملف الشخصي", icon: "👤" },
        { href: "/dashboard/notifications", label: "الإشعارات", icon: "🔔" },
      ],
    },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  const sections = NAV_BY_ROLE[role];
  const activePath = usePathname();

  return (
    <aside className="sticky top-0 flex h-dvh w-[236px] shrink-0 flex-col gap-0.5 bg-sidebar px-4 py-[22px]">
      <div className="mx-2 mb-6 mt-1 flex items-center gap-2.5 font-display text-xl font-black text-foreground">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-foreground text-sm text-surface">
          م
        </span>
        منجز
      </div>

      {sections.map((section) => (
        <div key={section.label}>
          <div className="mx-3 mb-2 mt-4 text-[11px] font-extrabold tracking-wide text-faint">
            {section.label}
          </div>
          {section.items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? activePath === "/dashboard"
                : activePath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-bold ${
                  isActive
                    ? "bg-surface text-accent-500 shadow-[0_6px_16px_-8px_rgba(62,123,250,0.35)]"
                    : "text-muted hover:bg-surface/60"
                }`}
              >
                <span className="w-[18px] text-center text-[15px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
