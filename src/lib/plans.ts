import type { PlanType } from "@/lib/types/organization";

/**
 * The one real, enforced difference between plans right now: a seat cap.
 * A plain constant, not a database table - with only two tiers and one
 * limit, a configurable-limits table would be speculative complexity.
 * `null` means unlimited.
 */
export const PLAN_SEAT_LIMITS: Record<PlanType, number | null> = {
  free: 5,
  paid: null,
};

export function seatLimitFor(planType: PlanType): number | null {
  return PLAN_SEAT_LIMITS[planType];
}

export const PLAN_LABEL: Record<PlanType, string> = {
  free: "مجانية",
  paid: "مدفوعة",
};
