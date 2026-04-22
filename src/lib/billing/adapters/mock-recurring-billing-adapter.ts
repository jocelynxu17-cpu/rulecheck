import { createAdminClient } from "@/lib/supabase/admin";
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
} from "@/lib/billing/provider-types";
import { deriveBillingUiState } from "@/lib/billing/subscription-state";

/**
 * Placeholder provider: records interest events and returns copy for the UI.
 * Swap env to `newebpay` when the real adapter is ready.
 */
export class MockRecurringBillingAdapter implements RecurringBillingPort {
  private recordProInterest(userId: string) {
    try {
      const admin = createAdminClient();
      const ymd = new Date().toISOString().slice(0, 10);
      void admin.from("payment_events").insert({
        user_id: userId,
        provider: "mock",
        event_type: "pro_interest",
        idempotency_key: `mock:recurring:${userId}:${ymd}`,
        payload: { source: "mock_recurring_billing_adapter" },
      });
    } catch {
      /* service role not configured locally */
    }
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionCreationResult> {
    this.recordProInterest(input.userId);
    return {
      ok: true,
      mode: "placeholder",
      checkoutUrl: null,
      message: "已記錄你的開通意願。台灣在地金流上線後，我們會以 Email 通知並啟用線上升級。",
    };
  }

  async cancelSubscription(_input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    return {
      ok: true,
      mode: "placeholder",
      message:
        "線上取消／週期管理將在台灣金流串接完成後開放。若需立即協助，請透過設定頁的聯絡方式與我們聯繫。",
    };
  }

  async getSubscriptionStatus(input: GetSubscriptionStatusInput): Promise<SubscriptionStatusResult> {
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

  async handlePaymentNotification(_input: PaymentNotificationInput): Promise<PaymentNotificationResult> {
    return {
      ok: true,
      handled: false,
      reason: "unsupported_event",
    };
  }

  async syncSubscriptionState(_input: SyncSubscriptionInput): Promise<SyncSubscriptionResult> {
    return { ok: true, updated: false };
  }
}
