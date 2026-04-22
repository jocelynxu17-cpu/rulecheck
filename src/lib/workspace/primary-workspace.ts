import type { SupabaseClient } from "@supabase/supabase-js";

/** Billing / quota fields aligned with {@link import("@/lib/billing/types").UserBillingSnapshot} for deriveBillingUiState. */
export type WorkspaceBillingRow = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  monthly_quota_units: number;
  units_used_month: number;
  usage_month: string;
};

const workspaceSelect = `
  id,
  name,
  plan,
  subscription_status,
  billing_provider,
  cancel_at_period_end,
  current_period_end,
  monthly_quota_units,
  units_used_month,
  usage_month
`;

/**
 * Prefer a workspace the user owns; otherwise first membership.
 * 產品 UI 帳務讀取請優先使用 getPrimaryWorkspaceBillingUiSnapshot（@/lib/workspace/workspace-billing-snapshot）。
 */
export async function getPrimaryWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceBillingRow | null> {
  const { data: owned } = await supabase
    .from("workspace_members")
    .select(`workspaces (${workspaceSelect})`)
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  const w0 = owned?.workspaces as unknown as WorkspaceBillingRow | null | undefined;
  if (w0) return w0;

  const { data: anyMem } = await supabase
    .from("workspace_members")
    .select(`workspaces (${workspaceSelect})`)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const w1 = anyMem?.workspaces as unknown as WorkspaceBillingRow | null | undefined;
  return w1 ?? null;
}
