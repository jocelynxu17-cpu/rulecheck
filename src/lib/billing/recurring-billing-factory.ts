import { MockRecurringBillingAdapter } from "@/lib/billing/adapters/mock-recurring-billing-adapter";
import { NewebPayBillingAdapter } from "@/lib/billing/adapters/newebpay-billing-adapter";
import type { RecurringBillingPort } from "@/lib/billing/ports/recurring-billing-port";

/**
 * Resolves the active recurring billing implementation.
 * Set `BILLING_PROVIDER=newebpay` when the NewebPay adapter is fully wired; default is mock.
 */
export function getRecurringBillingPort(): RecurringBillingPort {
  const id = (process.env.BILLING_PROVIDER ?? "mock").toLowerCase();
  switch (id) {
    case "newebpay":
      return new NewebPayBillingAdapter();
    case "mock":
    default:
      return new MockRecurringBillingAdapter();
  }
}
