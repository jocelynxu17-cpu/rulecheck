import type {
  CancelSubscriptionResult,
  PaymentNotificationInput,
  PaymentNotificationResult,
  SubscriptionCreationResult,
  SubscriptionStatusResult,
  SyncSubscriptionInput,
  SyncSubscriptionResult,
} from "@/lib/billing/provider-types";
import type { UserBillingSnapshot } from "@/lib/billing/types";

export type CreateSubscriptionInput = {
  userId: string;
  email: string | null;
  /** Product plan slug, e.g. `pro` */
  plan?: string;
};

export type CancelSubscriptionInput = {
  userId: string;
};

export type GetSubscriptionStatusInput = {
  userId: string;
  /** Snapshot from `users` — real adapters may merge with PSP queries. */
  localSnapshot: UserBillingSnapshot | null;
};

/**
 * Recurring billing integration boundary. Implementations: mock (default), NewebPayBillingAdapter, etc.
 * Route handlers stay thin: auth → port call → map to HTTP.
 */
export interface RecurringBillingPort {
  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionCreationResult>;

  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;

  getSubscriptionStatus(input: GetSubscriptionStatusInput): Promise<SubscriptionStatusResult>;

  /** Webhook / IPN entry: verify + normalize + persist (subscriptions / payment_events / users). */
  handlePaymentNotification(input: PaymentNotificationInput): Promise<PaymentNotificationResult>;

  /** Reconcile DB with PSP (cron, after webhook, or admin). */
  syncSubscriptionState(input: SyncSubscriptionInput): Promise<SyncSubscriptionResult>;
}
