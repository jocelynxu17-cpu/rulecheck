import type { BillingUiState } from "@/lib/billing/types";

/**
 * Canonical subscription lifecycle states used across providers after mapping.
 * Persisted `subscription_status` on `users` should use these string values where possible.
 */
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

/** Result of initiating a subscription / checkout (HTTP or redirect). */
export type SubscriptionCreationResult =
  | {
      ok: true;
      mode: "redirect";
      checkoutUrl: string;
      message?: string;
      /** Set when provider creates a provisional subscription record */
      externalSubscriptionId?: string | null;
    }
  | {
      ok: true;
      mode: "placeholder";
      checkoutUrl: null;
      message: string;
    }
  | { ok: false; error: string; code?: string };

/** Result of a cancel / cancel-at-period-end request. */
export type CancelSubscriptionResult =
  | {
      ok: true;
      mode: "placeholder";
      message: string;
    }
  | {
      ok: true;
      mode: "applied";
      message: string;
      cancelAtPeriodEnd: boolean;
    }
  | { ok: false; error: string; code?: string };

/** Read model returned by the port (maps 1:1 to public GET /api/billing/status). */
export type SubscriptionStatusResult = {
  userId: string;
  plan: string | null;
  subscriptionStatus: string | null;
  billingProvider: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  derivedState: BillingUiState;
};

/**
 * Normalized PSP webhook / return URL payload after transport-specific parsing.
 * Signing verification happens in the adapter or a dedicated verifier — not in route handlers.
 */
export type NormalizedPaymentNotification =
  | {
      provider: "newebpay";
      /** Stable id for idempotency (order id, trade no, etc.) */
      providerEventId: string;
      eventType: string;
      merchantOrderNo: string | null;
      /** Raw key-value pairs after form/query decode */
      raw: Record<string, unknown>;
      occurredAt: string | null;
    }
  | {
      provider: "unknown";
      raw: Record<string, unknown>;
    };

export type PaymentNotificationInput = {
  /** Opaque body from POST / GET — adapter normalizes to {@link NormalizedPaymentNotification} */
  payload: unknown;
  headers?: Headers | Record<string, string | null | undefined>;
};

export type PaymentNotificationResult =
  | {
      ok: true;
      handled: true;
      idempotencyKey: string | null;
      /** High-level actions for logging / tests */
      appliedActions: readonly string[];
    }
  | {
      ok: true;
      handled: false;
      reason: "ignored" | "duplicate" | "unsupported_event";
    }
  | { ok: false; error: string; code?: string };

export type SyncSubscriptionInput = {
  userId?: string;
  externalSubscriptionId?: string;
  reason?: "webhook" | "cron" | "manual";
};

export type SyncSubscriptionResult =
  | { ok: true; updated: boolean; userId?: string | null }
  | { ok: false; error: string; code?: string };
