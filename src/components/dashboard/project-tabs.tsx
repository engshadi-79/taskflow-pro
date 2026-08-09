"use client";

import { useState } from "react";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "tasks", label: "المهام" },
  { key: "kanban", label: "كانبان" },
  { key: "milestones", label: "المراحل" },
  { key: "team", label: "الفريق" },
  { key: "files", label: "الملفات" },
  { key: "activity", label: "النشاط" },
] as const;

export type ProjectTabKey = (typeof TABS)[number]["key"];

/**
 * All seven panels are fetched and rendered server-side up front (see
 * projects/[id]/page.tsx) and handed to this component as ready-made JSX -
 * switching tabs is a pure client-side visibility toggle, no extra
 * round-trip per tab.
 */
export function ProjectTabs({ panels }: { panels: Record<ProjectTabKey, React.ReactNode> }) {
  const [active, setActive] = useState<ProjectTabKey>("overview");

  return (
    <div>
      <div className="mb-4.5 flex flex-wrap gap-2 overflow-x-auto border-b border-border pb-3.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            aria-current={active === tab.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
              active === tab.key
                ? "bg-foreground text-surface"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}
