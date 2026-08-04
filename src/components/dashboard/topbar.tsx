import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-foreground px-7">
      <div className="flex items-center gap-4.5 text-surface">
        <span className="font-display text-base font-bold">منجز</span>
        <div className="hidden w-70 items-center gap-2.5 rounded-[9px] bg-white/10 px-4 py-2.5 text-[13px] text-white/60 sm:flex">
          🔍 ابحث في القائمة...
        </div>
      </div>

      <div className="flex items-center gap-4.5">
        <NotificationBell userId={userId} initialUnreadCount={unreadCount} />
        <ThemeToggle />
        <div className="flex items-center gap-2.5 text-[13px] font-bold text-surface">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-xs font-extrabold">
            {initials(fullName)}
          </div>
          <div className="hidden sm:block">
            <div>{fullName}</div>
            <div className="text-[11px] font-medium text-white/50">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-surface hover:bg-white/10"
          >
            تسجيل الخروج
          </button>
        </form>
      </div>
    </header>
  );
}
