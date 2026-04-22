import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUserRow, AdminWorkspaceRow } from "@/components/admin/AdminPanel";

export type AdminListsResult = {
  workspaces: AdminWorkspaceRow[];
  users: AdminUserRow[];
  listError: string | null;
  usersError: string | null;
};

export async function loadAdminLists(): Promise<AdminListsResult> {
  const empty: AdminListsResult = {
    workspaces: [],
    users: [],
    listError: null,
    usersError: null,
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ...empty,
      listError: "未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入列表。",
    };
  }

  try {
    const admin = createAdminClient();
    const [wsRes, uRes] = await Promise.all([
      admin
        .from("workspaces")
        .select(
          "id, name, plan, subscription_status, billing_provider, cancel_at_period_end, current_period_end, monthly_quota_units, units_used_month, usage_month, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("users")
        .select(
          "id, email, plan, subscription_status, monthly_analysis_quota, analyses_used_month, usage_month, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    return {
      workspaces: wsRes.error ? [] : ((wsRes.data ?? []) as AdminWorkspaceRow[]),
      users: uRes.error ? [] : ((uRes.data ?? []) as AdminUserRow[]),
      listError: wsRes.error?.message ?? null,
      usersError: uRes.error?.message ?? null,
    };
  } catch (e) {
    return {
      ...empty,
      listError: e instanceof Error ? e.message : "無法建立管理連線",
    };
  }
}
