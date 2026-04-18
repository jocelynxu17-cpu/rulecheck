import type { BillingUiState, UserBillingSnapshot, WorkspaceBillingSnapshot } from "@/lib/billing/types";

const ACTIVE_LIKE = new Set(["active", "trialing"]);

const PAYMENT_ISSUE = new Set(["past_due", "unpaid"]);

/**
 * Derives a single UI state from billing snapshot fields (user or workspace row).
 * Works before any Taiwan PSP is connected; webhook handlers can populate the same fields later.
 */
export function deriveBillingUiState(
  profile: UserBillingSnapshot | WorkspaceBillingSnapshot | null | undefined
): BillingUiState {
  if (!profile) return "free";

  const status = (profile.subscription_status ?? "").toLowerCase();
  const plan = (profile.plan ?? "free").toLowerCase();

  if (PAYMENT_ISSUE.has(status)) return "payment_issue";

  const proLike = plan === "pro";
  const activeLike = ACTIVE_LIKE.has(status);

  if (proLike && activeLike && profile.cancel_at_period_end) return "cancel_scheduled";
  if (proLike && activeLike) return "active";

  return "free";
}

/** Maps stored provider ids to neutral UI copy (never surfaces third-party brands as product copy). */
export function billingProviderLabelZh(provider: string | null | undefined): string | null {
  if (!provider) return null;
  const p = provider.toLowerCase();
  if (p === "none") return null;
  if (p === "manual") return "人工設定";
  if (p === "newebpay") return "台灣金流";
  if (p === "stripe") return "既有訂閱";
  return "其他";
}

export function subscriptionStatusLabelZh(status: string | null | undefined): string {
  const s = (status ?? "—").toLowerCase();
  const map: Record<string, string> = {
    active: "有效",
    trialing: "試用中",
    past_due: "付款逾期",
    unpaid: "未付款",
    canceled: "已取消",
    incomplete: "待完成付款",
    incomplete_expired: "付款未完成（已過期）",
    paused: "已暫停",
  };
  return map[s] ?? status ?? "—";
}
