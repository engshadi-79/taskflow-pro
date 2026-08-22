import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { UserMenu } from "@/components/dashboard/user-menu";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { RecentActivityButton } from "@/components/dashboard/recent-activity-button";
import { ChatQuickAccessButton } from "@/components/dashboard/chat-quick-access-button";
import { HelpQuickAccessButton } from "@/components/dashboard/help-quick-access-button";
import type { Role } from "@/lib/types/roles";

export function Topbar({
  userId,
  fullName,
  role,
  jobTitle,
  avatarUrl,
  currentEmail,
  unreadCount,
  recentActivityCount,
}: {
  userId: string;
  fullName: string;
  role: Role;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  currentEmail: string;
  unreadCount: number;
  recentActivityCount: number;
}) {
  return (
    // z-20 keeps the dropdowns above page content, and still below the
    // z-30 sidebar rail
    <header className="sticky top-0 z-20 flex h-[70px] shrink-0 items-center justify-center border-b border-border bg-surface px-3 sm:justify-between sm:px-6">
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

      <div className="flex items-center gap-2 sm:gap-2.5">
        <RecentActivityButton userId={userId} initialCount={recentActivityCount} />
        <ChatQuickAccessButton />
        <HelpQuickAccessButton />

        {/* Switching to the separate /m mobile site is redundant once this
            dashboard is itself responsive, and confusing on a phone - kept
            desktop-only. */}
        <Link
          href="/m"
          title="تطبيق الجوال"
          aria-label="تطبيق الجوال"
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition-colors hover:brightness-95 sm:flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path d="M11 18h2" />
          </svg>
        </Link>

        <CommandPalette role={role} />
        <NotificationBell userId={userId} initialUnreadCount={unreadCount} />
        <ThemeToggle />

        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

        {/* sign-out now lives inside this menu, as on the reference portal */}
        <UserMenu
          fullName={fullName}
          role={role}
          jobTitle={jobTitle}
          avatarUrl={avatarUrl}
          currentEmail={currentEmail}
        />
      </div>
    </header>
  );
}
