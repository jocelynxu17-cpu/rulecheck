/**
 * Database-aligned models for recurring billing.
 * Provider values are stored as data; the product UI stays provider-agnostic.
 */
import type { SubscriptionStatusResult } from "@/lib/billing/provider-types";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  plan: string;
  external_subscription_id: string | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PaymentEventRow = {
  id: string;
  user_id: string | null;
  subscription_id: string | null;
  provider: string;
  event_type: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/** Snapshot fields mirrored on `users` or `workspaces` for fast reads (RLS-friendly). */
export type UserBillingSnapshot = {
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

/** Same shape as user billing snapshot; persisted on `workspaces` as SSOT for team billing UI. */
export type WorkspaceBillingSnapshot = UserBillingSnapshot;

/**
 * 產品 UI 讀取之工作區帳務快照（僅來自 `workspaces` 主列，見 getPrimaryWorkspaceBillingUiSnapshot）。
 * 延伸 {@link UserBillingSnapshot} 之欄位可直接傳入 deriveBillingUiState。
 */
export type WorkspaceBillingUiSnapshot = UserBillingSnapshot & {
  workspaceId: string;
  workspaceName: string;
  monthly_quota_units: number;
  units_used_month: number;
  usage_month: string;
};

export type BillingCheckoutResponse = {
  ok: boolean;
  mode: "placeholder" | "redirect";
  message: string;
  /** When a real provider is wired, redirect or open this URL. */
  checkoutUrl: string | null;
};

export type BillingCancelResponse = {
  ok: boolean;
  mode: "placeholder" | "applied";
  message: string;
};

export type BillingUiState = "free" | "active" | "cancel_scheduled" | "payment_issue";

/** HTTP GET /api/billing/status — extends subscription result with workspace context. */
export type BillingStatusResponse = SubscriptionStatusResult & {
  workspaceId?: string | null;
  workspaceName?: string | null;
};
