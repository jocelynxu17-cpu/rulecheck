import type {
  RecurringBillingPort,
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  GetSubscriptionStatusInput,
} from "@/lib/billing/ports/recurring-billing-port";
import type {
  PaymentNotificationInput,
  PaymentNotificationResult,
  SubscriptionCreationResult,
  CancelSubscriptionResult,
  SubscriptionStatusResult,
  SyncSubscriptionInput,
  SyncSubscriptionResult,
  NormalizedPaymentNotification,
} from "@/lib/billing/provider-types";
import { deriveBillingUiState } from "@/lib/billing/subscription-state";
import { mapNewebPayStatusToCanonical } from "@/lib/billing/provider-status-map";

/**
 * NewebPay recurring billing adapter (skeleton).
 *
 * TODO: Inject merchant config (HashKey, HashIV, MerchantID) via env / secrets.
 * TODO: Implement MPG / period API request signing per official docs (not done here).
 * TODO: Persist to `subscriptions`, `payment_events`, and mirror snapshot fields on `users`.
 * TODO: Use `mapNewebPayStatusToCanonical` when mapping webhook fields to DB.
 */
export class NewebPayBillingAdapter implements RecurringBillingPort {
  async createSubscription(_input: CreateSubscriptionInput): Promise<SubscriptionCreationResult> {
    // TODO(NewebPay): build signed checkout request; return { ok: true, mode: "redirect", checkoutUrl }
    return {
      ok: false,
      error: "NewebPay 訂閱建立尚未實作。",
      code: "newebpay_not_configured",
    };
  }

  async cancelSubscription(_input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    // TODO(NewebPay): call cancel / end-of-period API when available
    return {
      ok: false,
      error: "NewebPay 取消訂閱尚未實作。",
      code: "newebpay_not_configured",
    };
  }

  async getSubscriptionStatus(input: GetSubscriptionStatusInput): Promise<SubscriptionStatusResult> {
    // TODO(NewebPay): optionally merge remote subscription query with localSnapshot
    const profile = input.localSnapshot;
    return {
      userId: input.userId,
      plan: profile?.plan ?? null,
      subscriptionStatus: profile?.subscription_status ?? null,
      billingProvider: profile?.billing_provider ?? null,
      cancelAtPeriodEnd: Boolean(profile?.cancel_at_period_end),
      currentPeriodEnd: profile?.current_period_end ?? null,
      derivedState: deriveBillingUiState(profile),
    };
  }

  async handlePaymentNotification(input: PaymentNotificationInput): Promise<PaymentNotificationResult> {
    const normalized = this.tryNormalizeNotification(input.payload);
    if (normalized.provider === "unknown") {
      return { ok: true, handled: false, reason: "unsupported_event" };
    }

    // TODO(NewebPay): verify CheckCode / SHA / AES per API version; reject on mismatch
    void input.headers;
    if (normalized.provider === "newebpay") {
      void mapNewebPayStatusToCanonical(String(normalized.raw["Status"] ?? ""));
    }

    // TODO(NewebPay): upsert payment_events + subscriptions; update users snapshot; idempotency on providerEventId
    return {
      ok: false,
      error: "NewebPay 通知處理尚未實作。",
      code: "newebpay_notification_not_implemented",
    };
  }

  async syncSubscriptionState(_input: SyncSubscriptionInput): Promise<SyncSubscriptionResult> {
    // TODO(NewebPay): query period status and reconcile DB
    return { ok: true, updated: false };
  }

  /** Placeholder: coerce webhook body to NormalizedPaymentNotification. */
  private tryNormalizeNotification(payload: unknown): NormalizedPaymentNotification {
    if (payload == null || typeof payload !== "object") {
      return { provider: "unknown", raw: {} };
    }
    const raw = payload as Record<string, unknown>;
    const looksNewebPay = "MerchantID" in raw || "MerchantOrderNo" in raw || "TradeNo" in raw;
    if (!looksNewebPay) {
      return { provider: "unknown", raw };
    }

    // TODO(NewebPay): map actual field names from return URL / notify POST
    const providerEventId =
      typeof raw["MerchantOrderNo"] === "string"
        ? raw["MerchantOrderNo"]
        : typeof raw["TradeNo"] === "string"
          ? raw["TradeNo"]
          : "unknown";

    return {
      provider: "newebpay",
      providerEventId,
      eventType: typeof raw["Status"] === "string" ? String(raw["Status"]) : "unknown",
      merchantOrderNo: typeof raw["MerchantOrderNo"] === "string" ? raw["MerchantOrderNo"] : null,
      raw,
      occurredAt: typeof raw["PayTime"] === "string" ? raw["PayTime"] : null,
    };
  }
}
