import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ChevronDownIcon, LogoutIcon, SearchIcon } from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

export function Topbar({
  userId,
  fullName,
  role,
  unreadCount,
}: {
  userId: string;
  fullName: string;
  role: Role;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[70px] shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      {/* Institutional line, mirroring the ACAS lockup. The mark itself lives
          in the sidebar header, so it is deliberately not repeated here. */}
      <div className="hidden leading-tight sm:block">
        <div className="text-[15px] font-black text-foreground">
          نظام إدارة المهام والموظفين
        </div>
        <div className="text-[11px] font-medium text-muted">
          لوحة التحكم الإدارية
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          href="/dashboard/tasks"
          aria-label="بحث في المهام"
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-colors hover:brightness-95 sm:flex"
        >
          <SearchIcon className="h-[19px] w-[19px]" />
        </Link>

        <NotificationBell userId={userId} initialUnreadCount={unreadCount} />
        <ThemeToggle />

        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

        <Link
          href="/dashboard/profile"
          className="flex items-center gap-2.5 rounded-full border border-border bg-background py-1.5 pe-1.5 ps-3 transition-colors hover:border-accent-300"
        >
          <ChevronDownIcon className="hidden h-4 w-4 text-faint sm:block" />
          <div className="hidden text-end leading-tight sm:block">
            <div className="text-[13px] font-extrabold text-foreground">
              {fullName}
            </div>
            <div className="text-[11px] font-medium text-muted">
              {ROLE_LABEL[role]}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-purple-500 text-xs font-extrabold text-white">
            {initials(fullName)}
          </div>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-50 text-pink-600 transition-colors hover:brightness-95"
          >
            <LogoutIcon className="h-[19px] w-[19px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
