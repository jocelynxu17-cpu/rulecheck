import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserBillingSnapshot, WorkspaceBillingUiSnapshot } from "@/lib/billing/types";
import { getPrimaryWorkspaceForUser, type WorkspaceBillingRow } from "@/lib/workspace/primary-workspace";

/** 由工作區列轉成 deriveBillingUiState 用的快照（不含 workspaceId／額度欄位）。 */
export function workspaceBillingRowToUserSnapshot(ws: WorkspaceBillingRow): UserBillingSnapshot {
  return {
    plan: ws.plan,
    subscription_status: ws.subscription_status,
    billing_provider: ws.billing_provider,
    cancel_at_period_end: ws.cancel_at_period_end,
    current_period_end: ws.current_period_end,
  };
}

/** 工作區帳務 SSOT 之完整 UI 讀取模型。 */
export function workspaceBillingRowToUiSnapshot(ws: WorkspaceBillingRow): WorkspaceBillingUiSnapshot {
  const base = workspaceBillingRowToUserSnapshot(ws);
  return {
    ...base,
    workspaceId: ws.id,
    workspaceName: ws.name,
    monthly_quota_units: ws.monthly_quota_units,
    units_used_month: ws.units_used_month,
    usage_month: ws.usage_month,
  };
}

/** 由 UI 快照取出 deriveBillingUiState／adapter 用欄位。 */
export function workspaceBillingUiToUserSnapshot(ui: WorkspaceBillingUiSnapshot): UserBillingSnapshot {
  return {
    plan: ui.plan,
    subscription_status: ui.subscription_status,
    billing_provider: ui.billing_provider,
    cancel_at_period_end: ui.cancel_at_period_end,
    current_period_end: ui.current_period_end,
  };
}

/**
 * 取得目前使用者「主要工作區」之帳務 UI 快照（方案／訂閱／額度等一律以工作區為準）。
 */
export async function getPrimaryWorkspaceBillingUiSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceBillingUiSnapshot | null> {
  const row = await getPrimaryWorkspaceForUser(supabase, userId);
  return row ? workspaceBillingRowToUiSnapshot(row) : null;
}
