import type { ComponentType } from "react";
import { BookIcon, CheckCircleIcon, CheckSquareIcon, InfoIcon, LockIcon, NoteIcon } from "@/components/shared/icons";
import type { CategoryTone } from "@/lib/types/knowledge";

/** icon key (stored in knowledge_categories.icon) -> icon component. */
export const CATEGORY_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  lock: LockIcon,
  "check-square": CheckSquareIcon,
  note: NoteIcon,
  book: BookIcon,
  info: InfoIcon,
  "check-circle": CheckCircleIcon,
};

/** Same tone vocabulary as StatCard's tone prop, mapped onto this project's existing color tokens. */
export const CATEGORY_TONE_CLASSES: Record<CategoryTone, { bg: string; fg: string; dot: string }> = {
  red: { bg: "bg-brand-red-50", fg: "text-brand-red-600", dot: "bg-brand-red-500" },
  indigo: { bg: "bg-accent-50", fg: "text-accent-600", dot: "bg-accent-600" },
  green: { bg: "bg-green-50", fg: "text-green-600", dot: "bg-green-500" },
  blue: { bg: "bg-brand-blue-50", fg: "text-brand-blue-600", dot: "bg-brand-blue-500" },
  amber: { bg: "bg-orange-50", fg: "text-orange-600", dot: "bg-orange-500" },
  violet: { bg: "bg-purple-50", fg: "text-purple-600", dot: "bg-purple-500" },
  teal: { bg: "bg-teal-50", fg: "text-teal-600", dot: "bg-teal-500" },
};
