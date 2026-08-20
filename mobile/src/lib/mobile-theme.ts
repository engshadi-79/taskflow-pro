/**
 * Same status/priority vocabulary as the web app's src/lib/mobile-theme.ts
 * and desktop kanban-board.tsx COLUMNS/PRIORITY_TAG - kept in sync so a
 * task's color coding means the same thing on every surface.
 */
export type TaskStatus = "new" | "in_progress" | "pending_review" | "completed" | "overdue" | "cancelled";
export type Priority = "low" | "medium" | "high" | "urgent";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  pending_review: "بانتظار المراجعة",
  completed: "مكتملة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const STATUS_COLOR: Record<TaskStatus, { text: string; bg: string; dot: string }> = {
  new: { text: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
  in_progress: { text: "#0e857b", bg: "#effcf9", dot: "#0e857b" },
  pending_review: { text: "#d97706", bg: "#fffbeb", dot: "#d97706" },
  completed: { text: "#15803d", bg: "#ecfdf5", dot: "#15803d" },
  overdue: { text: "#b02a37", bg: "#fef2f2", dot: "#dc3545" },
  cancelled: { text: "#64748b", bg: "#e2e8f0", dot: "#94a3b8" },
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#d97706",
  urgent: "#dc3545",
};

export const GRADIENT_PRIMARY = ["#7c72ea", "#4f46c9"] as const;
