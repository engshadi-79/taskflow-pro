import type { Priority, TaskStatus } from "@/lib/types/task";

/** The one gradient reused across mobile screens with a "hero" header
 * (dashboard, task detail) - transcribed from the Claude Design mockup
 * (منجز - تطبيق الجوال.dc.html). Plain list screens (tasks, kanban,
 * notifications, ...) intentionally use the app's existing bg-background/
 * text-foreground tokens instead, matching the mockup's own plain-header
 * screens and keeping this file small. */
export const MOBILE_GRADIENT_PRIMARY = "linear-gradient(135deg, #7c72ea 0%, #4f46c9 100%)";

/** Same status colors already used by the desktop Kanban board
 * (kanban-board.tsx's COLUMNS), reused here for visual consistency between
 * the desktop and mobile task views. */
export const MOBILE_STATUS_STYLE: Record<TaskStatus, { badge: string; dot: string }> = {
  new: { badge: "bg-brand-blue-50 text-brand-blue-600", dot: "bg-brand-blue-500" },
  in_progress: { badge: "bg-teal-50 text-teal-500", dot: "bg-teal-500" },
  pending_review: { badge: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  completed: { badge: "bg-green-50 text-green-500", dot: "bg-green-500" },
  overdue: { badge: "bg-brand-red-50 text-brand-red-500", dot: "bg-brand-red-500" },
  cancelled: { badge: "bg-border text-muted", dot: "bg-faint" },
};

/** Mirrors the desktop Kanban board's PRIORITY_TAG. */
export const MOBILE_PRIORITY_STYLE: Record<Priority, { text: string; dot: string }> = {
  low: { text: "text-muted", dot: "bg-faint" },
  medium: { text: "text-brand-blue-600", dot: "bg-brand-blue-500" },
  high: { text: "text-orange-600", dot: "bg-orange-500" },
  urgent: { text: "text-brand-red-500", dot: "bg-brand-red-500" },
};
