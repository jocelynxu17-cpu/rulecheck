import type { SupabaseClient } from "@supabase/supabase-js";
import { toCanonicalSubscriptionStatus } from "@/lib/billing/subscription-status-canonical";

/** 可寫入 public.workspaces 的帳務欄位（工作區為帳務 SSOT）。 */
export type WorkspaceBillingStatePatch = {
  plan?: string | null;
  subscription_status?: string | null;
  monthly_quota_units?: number | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  billing_provider?: string | null;
};

function stripUndefined<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function applyWorkspaceBillingState(
  admin: SupabaseClient,
  workspaceId: string,
  patch: WorkspaceBillingStatePatch
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = stripUndefined({ ...patch }) as WorkspaceBillingStatePatch;
  if (row.subscription_status !== undefined) {
    row.subscription_status = toCanonicalSubscriptionStatus(row.subscription_status as string | null);
  }
  if (Object.keys(row).length === 0) {
    return { ok: true };
  }

  const { error } = await admin.from("workspaces").update(row).eq("id", workspaceId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateWorkspacePlan(
  admin: SupabaseClient,
  workspaceId: string,
  plan: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  return applyWorkspaceBillingState(admin, workspaceId, { plan });
}

export async function updateWorkspaceSubscriptionStatus(
  admin: SupabaseClient,
  workspaceId: string,
  subscriptionStatus: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  return applyWorkspaceBillingState(admin, workspaceId, {
    subscription_status: subscriptionStatus as string | null,
  });
}

export async function updateWorkspaceMonthlyQuotaUnits(
  admin: SupabaseClient,
  workspaceId: string,
  monthlyQuotaUnits: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  return applyWorkspaceBillingState(admin, workspaceId, { monthly_quota_units: monthlyQuotaUnits });
}

export async function updateWorkspaceCurrentPeriodEnd(
  admin: SupabaseClient,
  workspaceId: string,
  currentPeriodEndIso: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  return applyWorkspaceBillingState(admin, workspaceId, { current_period_end: currentPeriodEndIso });
}

export async function updateWorkspaceCancelAtPeriodEnd(
  admin: SupabaseClient,
  workspaceId: string,
  cancelAtPeriodEnd: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  return applyWorkspaceBillingState(admin, workspaceId, { cancel_at_period_end: cancelAtPeriodEnd });
}

/** 取得使用者作為擁有者的第一個工作區（帳務寫回目標）。 */
export async function getOwnerWorkspaceIdForUserAdmin(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .order("workspace_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.workspace_id) {
    return null;
  }
  return data.workspace_id as string;
}

export async function assertUserOwnsWorkspaceForBilling(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();

  return !!data?.workspace_id;
}
