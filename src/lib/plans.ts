import type { Organization, PlanType } from "@/lib/types/organization";

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

/** Free organizations get 14 days from creation before dashboard/layout.tsx
 *  blocks them at /trial-expired - paid organizations never expire. Plain
 *  wall-clock time since claim_new_organization sets created_at once at
 *  signup, not something a re-signup or retry can reset. */
export const TRIAL_DAYS = 14;

export function isTrialExpired(organization: Pick<Organization, "plan_type" | "created_at">): boolean {
  if (organization.plan_type !== "free") return false;
  const ageMs = Date.now() - new Date(organization.created_at).getTime();
  return ageMs > TRIAL_DAYS * 24 * 60 * 60 * 1000;
}
