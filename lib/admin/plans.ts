export type PlanTier = "learner" | "pro" | "hacker";
export type BillingInterval = "monthly" | "sixmonth";

export function normalizePlanTier(value: unknown): PlanTier {
  if (value === "pro" || value === "hacker" || value === "learner") {
    return value;
  }
  if (value === "premium") return "hacker";
  if (value === "free") return "learner";
  if (value === "regular") return "pro";
  return "learner";
}

export function normalizeBillingInterval(
  value: unknown
): BillingInterval | undefined {
  if (value === "monthly" || value === "sixmonth") return value;
  if (value === "yearly") return "sixmonth";
  return undefined;
}

export function planLabel(plan: PlanTier): string {
  switch (plan) {
    case "pro":
      return "Pro";
    case "hacker":
      return "Hacker";
    default:
      return "Learner";
  }
}

export function isPaidPlan(plan: PlanTier | null | undefined): boolean {
  return Boolean(plan && plan !== "learner");
}
