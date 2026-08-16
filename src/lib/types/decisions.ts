export type InsightSeverity = "critical" | "warning" | "good" | "info";

/**
 * One "ماذا حدث / لماذا / ما الإجراء" card: a real number comparison
 * (never a fabricated risk score, matching the at-risk-projects precedent
 * from P04), a plain-language explanation, and a link to the existing
 * report page where the user can act on it.
 */
export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  action_label: string;
  action_href: string;
};

export const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "حرج",
  warning: "تنبيه",
  good: "تحسّن",
  info: "معلومة",
};
