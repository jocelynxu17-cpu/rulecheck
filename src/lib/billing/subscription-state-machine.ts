import type { BillingUiState } from "@/lib/billing/types";

/** Normalized statuses used when mapping PSP payloads → workspace snapshot. */
export type CanonicalSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unknown";

const ACTIVE_LIKE: CanonicalSubscriptionStatus[] = ["active", "trialing"];

const PAYMENT_ISSUE: CanonicalSubscriptionStatus[] = ["past_due", "unpaid"];

export function normalizeStripeSubscriptionStatus(raw: string | null | undefined): CanonicalSubscriptionStatus {
  const s = (raw ?? "").toLowerCase();
  if (
    s === "active" ||
    s === "trialing" ||
    s === "past_due" ||
    s === "unpaid" ||
    s === "canceled" ||
    s === "incomplete" ||
    s === "incomplete_expired" ||
    s === "paused"
  ) {
    return s;
  }
  return "unknown";
}

/** Maps canonical PSP status + plan flags → UI bucket (aligns with deriveBillingUiState). */
export function billingUiStateFromCanonical(
  planLower: string,
  status: CanonicalSubscriptionStatus,
  cancelAtPeriodEnd: boolean
): BillingUiState {
  if (PAYMENT_ISSUE.includes(status)) return "payment_issue";

  const proLike = planLower === "pro";
  const activeLike = ACTIVE_LIKE.includes(status);

  if (proLike && activeLike && cancelAtPeriodEnd) return "cancel_scheduled";
  if (proLike && activeLike) return "active";

  return "free";
}

/** Workspace row fields to persist after a successful paid period (NewebPay / Stripe). */
export function workspaceSnapshotPatchFromProvider(args: {
  plan: string;
  subscriptionStatus: string | null;
  billingProvider: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}): Record<string, unknown> {
  return {
    plan: args.plan,
    subscription_status: args.subscriptionStatus,
    billing_provider: args.billingProvider,
    cancel_at_period_end: args.cancelAtPeriodEnd,
    current_period_end: args.currentPeriodEnd,
  };
}
