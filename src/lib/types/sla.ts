import type { Priority } from "@/lib/types/task";

export type SlaPolicy = {
  id: string;
  organization_id: string;
  name: string;
  priority: Priority;
  response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  created_at: string;
};

export type SlaState = "on_time" | "near_due" | "breached" | "not_applicable";

export type TaskSla = {
  policy_name: string;
  response_minutes: number;
  resolution_minutes: number;
  response_due: string;
  resolution_due: string;
  responded: boolean;
  response_breached: boolean;
  resolution_breached: boolean;
  remaining_seconds: number;
  sla_state: SlaState;
};

export type SlaReport = {
  total_count: number;
  breached_count: number;
  compliance_rate: number;
  avg_response_minutes: number | null;
  avg_resolution_hours: number | null;
};

export const SLA_STATE_LABEL: Record<SlaState, string> = {
  on_time: "ضمن الوقت",
  near_due: "قريب من الانتهاء",
  breached: "متجاوز",
  not_applicable: "لا ينطبق",
};

export const SLA_STATE_COLOR: Record<SlaState, string> = {
  on_time: "bg-green-50 text-green-600",
  near_due: "bg-orange-50 text-orange-600",
  breached: "bg-brand-red-50 text-brand-red-500",
  not_applicable: "bg-border text-muted",
};
