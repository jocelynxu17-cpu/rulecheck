import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

/** 寫入 public.users 的訂閱同步欄位（僅包含本次要更新的 key，避免意外覆寫其他欄位）。 */
export type SubscriptionUserRowPatch = {
  plan?: string;
  monthly_analysis_quota?: number;
  subscription_status?: string;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
};

/** 與 public.workspaces 對齊的帳務欄位（工作區 SSOT）。 */
export type WorkspaceBillingStripePatch = {
  plan?: string;
  subscription_status?: string | null;
  billing_provider?: string | null;
  monthly_quota_units?: number;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
};

export function buildWorkspaceBillingPatchFromStripe(
  sub: Stripe.Subscription,
  userPatch: SubscriptionUserRowPatch
): WorkspaceBillingStripePatch {
  const periodEnd =
    typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
  const out: WorkspaceBillingStripePatch = {
    billing_provider: "stripe",
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_end: periodEnd,
  };
  if (userPatch.plan !== undefined) out.plan = userPatch.plan;
  if (userPatch.subscription_status !== undefined) out.subscription_status = userPatch.subscription_status;
  if (userPatch.monthly_analysis_quota !== undefined) out.monthly_quota_units = userPatch.monthly_analysis_quota;
  return out;
}

export function buildWorkspaceBillingPatchForDeleted(): WorkspaceBillingStripePatch {
  return {
    plan: "free",
    subscription_status: "canceled",
    monthly_quota_units: 30,
    billing_provider: null,
    cancel_at_period_end: false,
    current_period_end: null,
  };
}

export function buildWorkspaceBillingPatchFromUserPatch(userPatch: SubscriptionUserRowPatch): WorkspaceBillingStripePatch {
  const out: WorkspaceBillingStripePatch = { billing_provider: "stripe" };
  if (userPatch.plan !== undefined) out.plan = userPatch.plan;
  if (userPatch.subscription_status !== undefined) out.subscription_status = userPatch.subscription_status;
  if (userPatch.monthly_analysis_quota !== undefined) out.monthly_quota_units = userPatch.monthly_analysis_quota;
  return out;
}

export function stripeCustomerId(customer: Stripe.Subscription["customer"]): string | null {
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && "id" in customer) return String(customer.id);
  return null;
}

/** Checkout Session / Invoice 上常見的 `subscription: id | object` 欄位。 */
export function stripeSubscriptionIdFromExpandable(
  ref: string | Stripe.Subscription | null | undefined
): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref.id ?? null;
}

/**
 * 將 Stripe Subscription.status 對應到本產品的方案／配額／狀態字串。
 * 規則需與既有 Webhook 行為一致：
 * - active / trialing => Pro + 2000
 * - canceled / incomplete_expired => Free + 30（並清除 subscription id）
 * - past_due / unpaid => 維持 Pro + 2000，但標示帳務問題狀態
 * - incomplete => 僅同步 Stripe 狀態與 ids，不強制改 plan（避免與 checkout 競態）
 */
export function buildUserPatchFromStripeSubscription(sub: Stripe.Subscription): SubscriptionUserRowPatch {
  const customerId = stripeCustomerId(sub.customer);
  const status = sub.status;

  if (status === "active" || status === "trialing") {
    return {
      plan: "pro",
      monthly_analysis_quota: 2000,
      subscription_status: status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    };
  }

  if (status === "canceled" || status === "incomplete_expired") {
    return {
      plan: "free",
      monthly_analysis_quota: 30,
      subscription_status: status,
      stripe_subscription_id: null,
      stripe_customer_id: customerId,
    };
  }

  if (status === "past_due" || status === "unpaid") {
    return {
      plan: "pro",
      monthly_analysis_quota: 2000,
      subscription_status: status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    };
  }

  if (status === "incomplete") {
    return {
      subscription_status: status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    };
  }

  return {
    subscription_status: status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
  };
}

export function buildUserPatchForSubscriptionDeleted(): SubscriptionUserRowPatch {
  return {
    plan: "free",
    monthly_analysis_quota: 30,
    subscription_status: "canceled",
    stripe_subscription_id: null,
  };
}

export function buildUserPatchCheckoutFallback(params: {
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
}): SubscriptionUserRowPatch {
  return {
    plan: "pro",
    monthly_analysis_quota: 2000,
    subscription_status: "active",
    stripe_subscription_id: params.stripe_subscription_id,
    stripe_customer_id: params.stripe_customer_id,
  };
}

/**
 * 依序解析使用者 id：顯式參數 → subscription metadata → customer → subscription id。
 * 單一路徑集中處理，避免各事件重複實作造成不一致。
 */
export async function resolveUserIdForSubscriptionSync(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  hints: { explicitUserId?: string | null } = {}
): Promise<string | null> {
  if (hints.explicitUserId) return hints.explicitUserId;

  const metaId = sub.metadata?.user_id;
  if (metaId) return metaId;

  const customerId = stripeCustomerId(sub.customer);
  if (customerId) {
    const { data } = await admin.from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (data?.id) return String(data.id);
  }

  const { data } = await admin.from("users").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (data?.id) return String(data.id);

  return null;
}

/**
 * Invoice 專用：Invoice.metadata 常見於自訂擴充；若無，仍會退回 subscription 與 customer 查詢。
 */
export async function resolveUserIdForInvoicePaid(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const invoiceUserId = invoice.metadata?.user_id;
  return resolveUserIdForSubscriptionSync(admin, subscription, { explicitUserId: invoiceUserId });
}

/** 單一寫入出口：訂閱狀態同步（非 subscription.deleted）。 */
export async function applySubscriptionSyncToUser(
  admin: SupabaseClient,
  userId: string,
  sub: Stripe.Subscription
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch = buildUserPatchFromStripeSubscription(sub);
  const { error } = await admin.from("users").update(patch).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  const wsPatch = buildWorkspaceBillingPatchFromStripe(sub, patch);
  const { error: wsError } = await admin.from("workspaces").update(wsPatch).eq("created_by", userId);
  if (wsError) {
    console.error("applySubscriptionSyncToUser: workspace billing sync", wsError.message);
  }
  return { ok: true };
}

export async function applySubscriptionDeletedToUser(
  admin: SupabaseClient,
  opts: { userId?: string | null; stripeSubscriptionId?: string | null }
): Promise<void> {
  const patch = buildUserPatchForSubscriptionDeleted();
  const wsPatch = buildWorkspaceBillingPatchForDeleted();
  if (opts.userId) {
    await admin.from("users").update(patch).eq("id", opts.userId);
    const { error: wsError } = await admin.from("workspaces").update(wsPatch).eq("created_by", opts.userId);
    if (wsError) console.error("applySubscriptionDeletedToUser: workspace billing sync", wsError.message);
    return;
  }
  if (opts.stripeSubscriptionId) {
    const { data: rows } = await admin.from("users").select("id").eq("stripe_subscription_id", opts.stripeSubscriptionId);
    await admin.from("users").update(patch).eq("stripe_subscription_id", opts.stripeSubscriptionId);
    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    for (const uid of ids) {
      const { error: wsError } = await admin.from("workspaces").update(wsPatch).eq("created_by", uid);
      if (wsError) console.error("applySubscriptionDeletedToUser: workspace billing sync", wsError.message);
    }
  }
}
