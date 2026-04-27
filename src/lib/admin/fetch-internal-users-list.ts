import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";
import {
  INTERNAL_ACTIVITY_BATCH_CAP,
  INTERNAL_LIST_PAGE_DEFAULT,
  INTERNAL_LIST_PAGE_MAX,
  clampPage,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InternalUsersListRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_activity_at: string | null;
  workspace_count: number;
  plan: string | null;
  subscription_status: string | null;
  monthly_analysis_quota: number;
  analyses_used_month: number;
  usage_month: string;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  internal_access: boolean;
};

export type InternalUsersListResult = {
  users: InternalUsersListRow[];
  error: string | null;
  yymm: string;
  pagination: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  };
};

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** 內部用戶列表：含搜尋、工作區數、最近用量事件時間、內部權限旗標（分頁 + 下一頁偵測）。 */
export async function fetchInternalUsersList(
  searchQuery?: string | null,
  opts?: { page?: number; pageSize?: number }
): Promise<InternalUsersListResult> {
  const yymm = new Date().toISOString().slice(0, 7);
  const pageSize = clampPageSize(opts?.pageSize, INTERNAL_LIST_PAGE_DEFAULT, INTERNAL_LIST_PAGE_MAX);
  const page = clampPage(opts?.page);
  const offset = (page - 1) * pageSize;
  const empty: InternalUsersListResult = {
    users: [],
    error: null,
    yymm,
    pagination: { page, pageSize, hasNextPage: false },
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: "未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入列表。" };
  }

  const q = searchQuery?.trim() ?? "";

  try {
    const admin = createAdminClient();
    let uq = admin
      .from("users")
      .select(
        "id, email, plan, subscription_status, monthly_analysis_quota, analyses_used_month, usage_month, created_at, billing_provider, cancel_at_period_end, current_period_end"
      )
      .order("created_at", { ascending: false });

    if (q) {
      const esc = escapeIlikePattern(q);
      if (UUID_RE.test(q)) {
        uq = uq.or(`id.eq.${q},email.ilike.%${esc}%`);
      } else {
        uq = uq.ilike("email", `%${esc}%`);
      }
    }

    const fetchEnd = offset + pageSize;
    const { data: rawUsers, error: uErr } = await uq.range(offset, fetchEnd);
    if (uErr) {
      return { ...empty, error: uErr.message };
    }

    const batch = (rawUsers ?? []) as Array<{
      id: string;
      email: string | null;
      plan: string | null;
      subscription_status: string | null;
      monthly_analysis_quota: number;
      analyses_used_month: number;
      usage_month: string;
      created_at: string;
      billing_provider: string | null;
      cancel_at_period_end: boolean | null;
      current_period_end: string | null;
    }>;

    const hasNextPage = batch.length > pageSize;
    const rows = batch.slice(0, pageSize);

    const userIds = rows.map((u) => u.id);
    const userWsCount = new Map<string, number>();
    const lastActivityByUser = new Map<string, string>();

    if (userIds.length > 0) {
      const [{ data: um }, { data: evRows }] = await Promise.all([
        admin.from("workspace_members").select("user_id").in("user_id", userIds),
        admin
          .from("usage_events")
          .select("user_id, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(INTERNAL_ACTIVITY_BATCH_CAP),
      ]);

      for (const row of um ?? []) {
        const uid = (row as { user_id: string }).user_id;
        userWsCount.set(uid, (userWsCount.get(uid) ?? 0) + 1);
      }

      for (const ev of evRows ?? []) {
        const e = ev as { user_id: string; created_at: string };
        if (!lastActivityByUser.has(e.user_id)) {
          lastActivityByUser.set(e.user_id, e.created_at);
        }
      }
    }

    const users: InternalUsersListRow[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_activity_at: lastActivityByUser.get(u.id) ?? null,
      workspace_count: userWsCount.get(u.id) ?? 0,
      plan: u.plan,
      subscription_status: u.subscription_status,
      monthly_analysis_quota: u.monthly_analysis_quota,
      analyses_used_month: u.analyses_used_month,
      usage_month: u.usage_month,
      billing_provider: u.billing_provider,
      cancel_at_period_end: u.cancel_at_period_end,
      current_period_end: u.current_period_end,
      internal_access: canAccessInternalOps(u.email),
    }));

    return { users, error: null, yymm, pagination: { page, pageSize, hasNextPage } };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "無法建立管理連線",
    };
  }
}
