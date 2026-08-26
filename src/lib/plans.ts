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

export type PaymentMethod = "bank_transfer" | "binance";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "تحويل بنكي",
  binance: "Binance",
};

/** Only returns methods whose receiving details are actually configured -
 *  callers render nothing (or fall back to the plain note-only form) for an
 *  empty result, since asking someone to pay into an unset account isn't
 *  useful. Env-only (no NEXT_PUBLIC_ prefix), so this must be called from a
 *  Server Component and passed down as a prop - never import it into
 *  plan-billing-section.tsx directly (a Client Component). */
export function getConfiguredPaymentMethods(): Partial<Record<PaymentMethod, string>> {
  const methods: Partial<Record<PaymentMethod, string>> = {};
  if (process.env.PAYMENT_BANK_DETAILS?.trim()) methods.bank_transfer = process.env.PAYMENT_BANK_DETAILS.trim();
  if (process.env.PAYMENT_BINANCE_DETAILS?.trim()) methods.binance = process.env.PAYMENT_BINANCE_DETAILS.trim();
  return methods;
}

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

/** `null` for a paid organization (no trial clock at all) - otherwise the
 *  whole days left, floored so "13.9 days" reads as 13 remaining rather than
 *  rounding up to a day it hasn't actually reached yet, clamped at 0 once
 *  expired instead of going negative. */
export function trialDaysRemaining(organization: Pick<Organization, "plan_type" | "created_at">): number | null {
  if (organization.plan_type !== "free") return null;
  const ageMs = Date.now() - new Date(organization.created_at).getTime();
  const remainingMs = TRIAL_DAYS * 24 * 60 * 60 * 1000 - ageMs;
  return Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));
}
