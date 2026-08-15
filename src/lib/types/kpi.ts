export type KpiEvaluationStatus = "pending_manager_review" | "finalized";

export type EmployeeKpiEvaluation = {
  id: string;
  organization_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  completion_score: number;
  on_time_score: number;
  quality_score: number;
  manager_evaluation_score: number | null;
  manager_note: string | null;
  evaluated_by: string | null;
  total_score: number | null;
  status: KpiEvaluationStatus;
  created_at: string;
  finalized_at: string | null;
};

export const KPI_WEIGHTS = {
  completion: 0.3,
  on_time: 0.25,
  quality: 0.25,
  manager_evaluation: 0.2,
} as const;

export const KPI_STATUS_LABEL: Record<KpiEvaluationStatus, string> = {
  pending_manager_review: "بانتظار تقييم المدير",
  finalized: "مُعتمَد",
};
