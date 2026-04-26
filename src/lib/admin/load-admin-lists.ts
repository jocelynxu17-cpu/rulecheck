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
          "id, name, plan, subscription_status, billing_provider, cancel_at_period_end, current_period_end, monthly_quota_units, units_used_month, usage_month, created_at, created_by"
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

    const rawWs = (wsRes.data ?? []) as Array<
      AdminWorkspaceRow & { created_by?: string }
    >;
    const ownerIds = [...new Set(rawWs.map((w) => w.created_by).filter(Boolean))] as string[];
    let ownerEmailById: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await admin.from("users").select("id, email").in("id", ownerIds);
      for (const o of owners ?? []) {
        if (o.id && o.email) ownerEmailById[o.id] = o.email;
      }
    }

    const wsIds = rawWs.map((w) => w.id);
    const memberCountByWs = new Map<string, number>();
    if (wsIds.length > 0) {
      const { data: memRows } = await admin.from("workspace_members").select("workspace_id").in("workspace_id", wsIds);
      for (const m of memRows ?? []) {
        const wid = (m as { workspace_id: string }).workspace_id;
        memberCountByWs.set(wid, (memberCountByWs.get(wid) ?? 0) + 1);
      }
    }

    const workspaces: AdminWorkspaceRow[] = rawWs.map((w) => {
      const { created_by, ...rest } = w;
      return {
        ...rest,
        owner_email: created_by ? ownerEmailById[created_by] ?? null : null,
        member_count: memberCountByWs.get(w.id) ?? 0,
      };
    });

    const rawUsers = (uRes.data ?? []) as AdminUserRow[];
    const userIds = rawUsers.map((u) => u.id);
    const userWsCount = new Map<string, number>();
    if (userIds.length > 0) {
      const { data: um } = await admin.from("workspace_members").select("user_id").in("user_id", userIds);
      for (const row of um ?? []) {
        const uid = (row as { user_id: string }).user_id;
        userWsCount.set(uid, (userWsCount.get(uid) ?? 0) + 1);
      }
    }

    const users: AdminUserRow[] = rawUsers.map((u) => ({
      ...u,
      workspace_membership_count: userWsCount.get(u.id) ?? 0,
    }));

    return {
      workspaces: wsRes.error ? [] : workspaces,
      users: uRes.error ? [] : users,
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
