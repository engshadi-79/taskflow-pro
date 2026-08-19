"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/m",
    label: "الرئيسية",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      </svg>
    ),
  },
  {
    href: "/m/tasks",
    label: "المهام",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8 12.5 2.5 2.5L16 9.5" />
      </svg>
    ),
  },
  {
    href: "/m/kanban",
    label: "كانبان",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="5.5" height="16" rx="1.8" />
        <rect x="9.25" y="4" width="5.5" height="10" rx="1.8" />
        <rect x="15.5" y="4" width="5.5" height="13" rx="1.8" />
      </svg>
    ),
  },
  {
    href: "/m/notifications",
    label: "الإشعارات",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 3.2 1.4 5 1.4 5H5.1s1.4-1.8 1.4-5Z" />
        <path d="M9.8 17.5a2.4 2.4 0 0 0 4.4 0" />
      </svg>
    ),
  },
  {
    href: "/m/more",
    label: "المزيد",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    ),
  },
];

export function MobileTabBar({ hasUnread }: { hasUnread: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 border-t border-border bg-surface px-1 pb-1.5 pt-2 [box-shadow:0_-4px_14px_rgba(30,41,59,.06)]">
      {TABS.map((tab) => {
        const active = tab.href === "/m" ? pathname === "/m" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-0.5"
          >
            <span
              className={`flex items-center justify-center rounded-[10px] px-3 py-1 ${
                active ? "bg-accent-50 text-accent-600" : "text-faint"
              }`}
            >
              {tab.icon}
            </span>
            <span className={`text-[9.5px] font-bold ${active ? "text-accent-600" : "text-faint"}`}>
              {tab.label}
            </span>
            {tab.href === "/m/notifications" && hasUnread && (
              <span className="absolute end-[27%] top-0 h-2 w-2 rounded-full border-[1.5px] border-surface bg-brand-red-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
