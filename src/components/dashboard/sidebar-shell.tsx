"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MenuIcon } from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

/**
 * Owns the <md drawer's open/close state and renders the hamburger that
 * toggles it - Sidebar itself just reacts to `mobileOpen`/`onMobileClose`
 * props, so the nav items/links stay defined in exactly one place. md+
 * behaviour (the hover-expand rail) is untouched; this only adds a mobile
 * affordance on top of it.
 */
export function SidebarShell({
  role,
  logoUrl,
  isPlatformOwner,
  enabledFeatures,
  children,
}: {
  role: Role;
  logoUrl?: string | null;
  isPlatformOwner?: boolean;
  enabledFeatures?: string[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full">
      <Sidebar
        role={role}
        logoUrl={logoUrl}
        isPlatformOwner={isPlatformOwner}
        enabledFeatures={enabledFeatures}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center border-b border-border bg-surface px-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="فتح القائمة الجانبية"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-background"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
