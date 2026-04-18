import type { CanonicalSubscriptionStatus } from "@/lib/billing/provider-types";

/**
 * Maps NewebPay-specific status strings to canonical subscription states.
 * TODO: Replace placeholder mapping when integrating real NewebPay period / period API docs.
 */
export function mapNewebPayStatusToCanonical(providerStatus: string | null | undefined): CanonicalSubscriptionStatus {
  if (providerStatus == null || providerStatus === "") return "unknown";

  const s = providerStatus.trim().toLowerCase();

  const table: Record<string, CanonicalSubscriptionStatus> = {
    // TODO(NewebPay): align keys with official recurring / period payment status codes
    success: "active",
    paid: "active",
    active: "active",
    trial: "trialing",
    past_due: "past_due",
    unpaid: "unpaid",
    cancel: "canceled",
    cancelled: "canceled",
    canceled: "canceled",
    incomplete: "incomplete",
    paused: "paused",
  };

  return table[s] ?? "unknown";
}

/**
 * Maps any provider status string to canonical — extend with additional PSP tables as needed.
 */
export function mapProviderStatusToCanonical(
  provider: string,
  providerStatus: string | null | undefined
): CanonicalSubscriptionStatus {
  const p = provider.toLowerCase();
  if (p === "newebpay") return mapNewebPayStatusToCanonical(providerStatus);
  return "unknown";
}
