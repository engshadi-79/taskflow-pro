export type LoadStatus = "low" | "normal" | "high" | "critical";

export type WorkloadRow = {
  user_id: string;
  full_name: string;
  department_id: string | null;
  open_count: number;
  urgent_count: number;
  overdue_count: number;
  in_progress_count: number;
  load_score: number;
  load_percent: number;
  load_status: LoadStatus;
};

export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  low: "منخفض",
  normal: "طبيعي",
  high: "مرتفع",
  critical: "حرج",
};
