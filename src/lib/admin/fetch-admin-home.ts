import { createAdminClient } from "@/lib/supabase/admin";
import { isLikelyPaymentFailureEventType, isNotifyLikePaymentEvent } from "@/lib/admin/payment-event-signals";
import { countWorkspacesWithMultipleMembers } from "@/lib/admin/count-multi-member-workspaces";
import { getInternalRuntimeStatus, type InternalRuntimeStatus } from "@/lib/admin/internal-runtime-status";
import { fetchRecentInternalOpsAuditLogs, type InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";
import type { AdminAnalysisOverview } from "@/lib/admin/fetch-admin-analysis-overview";
import { buildEmptyAdminAnalysisOverview, fetchAdminAnalysisOverview } from "@/lib/admin/fetch-admin-analysis-overview";

export type AdminRecentWorkspace = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  created_at: string;
  usage_month: string;
  units_used_month: number;
};

export type AdminRecentInvite = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  workspace_name: string | null;
};

export type AdminPaymentEventRow = {
  id: string;
  provider: string;
  event_type: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  payload: Record<string, unknown>;
};

export type AdminHomeSnapshot = {
  ok: boolean;
  errorMessage: string | null;
  yymm: string;
  periodStart: string;
  runtime: InternalRuntimeStatus;
  totals: {
    userCount: number;
    workspaceCount: number;
    sharedWorkspaceCount: number;
    analysesThisMonth: number;
    chargedUnitsThisMonth: number;
  };
  recentWorkspaces: AdminRecentWorkspace[];
  recentInvites: AdminRecentInvite[];
  recentPaymentEvents: AdminPaymentEventRow[];
  errorLikePaymentEvents: AdminPaymentEventRow[];
  /** 帳務 notify（legacy / v1）寫入之 payment_events */
  recentBillingNotifyEvents: AdminPaymentEventRow[];
  /** 非 app provider 之失敗／異常類型（供應商層級） */
  recentProviderFailureEvents: AdminPaymentEventRow[];
  /** 內部營運稽核（最近寫入） */
  recentInternalOpsAudit: InternalOpsAuditRow[];
  /** 今日／近 7 日分析與工作區活躍度摘要 */
  analysisOverview: AdminAnalysisOverview;
};

function monthBoundsUtc(): { yymm: string; periodStart: string } {
  const yymm = new Date().toISOString().slice(0, 7);
  const [y, mo] = yymm.split("-").map(Number);
  const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
  return { yymm, periodStart };
}

export async function fetchAdminHomeSnapshot(): Promise<AdminHomeSnapshot> {
  const { yymm, periodStart } = monthBoundsUtc();
  const empty: AdminHomeSnapshot = {
    ok: false,
    errorMessage: null,
    yymm,
    periodStart,
    runtime: getInternalRuntimeStatus(),
    totals: {
      userCount: 0,
      workspaceCount: 0,
      sharedWorkspaceCount: 0,
      analysesThisMonth: 0,
      chargedUnitsThisMonth: 0,
    },
    recentWorkspaces: [],
    recentInvites: [],
    recentPaymentEvents: [],
    errorLikePaymentEvents: [],
    recentBillingNotifyEvents: [],
    recentProviderFailureEvents: [],
    recentInternalOpsAudit: [],
    analysisOverview: buildEmptyAdminAnalysisOverview(),
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ...empty,
      errorMessage: "未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入營運資料。",
    };
  }

  try {
    const admin = createAdminClient();

    const [
      userCountRes,
      wsCountRes,
      analysesRes,
      chargedUnitsRpc,
      recentWsRes,
      invitesRes,
      paymentsRes,
      sharedWorkspaceCount,
      auditOut,
    ] = await Promise.all([
      admin.from("users").select("*", { count: "exact", head: true }),
      admin.from("workspaces").select("*", { count: "exact", head: true }),
      admin
        .from("analysis_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", periodStart),
      admin.rpc("admin_sum_workspace_units_for_month", { p_usage_month: yymm }),
      admin
        .from("workspaces")
        .select(
          "id, name, plan, subscription_status, created_at, usage_month, units_used_month, monthly_quota_units"
        )
        .order("created_at", { ascending: false })
        .limit(8),
      admin
        .from("workspace_invites")
        .select(
          `
          id,
          workspace_id,
          email,
          role,
          created_at,
          accepted_at,
          revoked_at,
          expires_at,
          workspaces ( name )
        `
        )
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("payment_events")
        .select("id, provider, event_type, created_at, user_id, payload")
        .order("created_at", { ascending: false })
        .limit(80),
      countWorkspacesWithMultipleMembers(admin),
      fetchRecentInternalOpsAuditLogs(admin, 18),
    ]);

    const err =
      userCountRes.error?.message ??
      wsCountRes.error?.message ??
      analysesRes.error?.message ??
      chargedUnitsRpc.error?.message ??
      recentWsRes.error?.message ??
      invitesRes.error?.message ??
      paymentsRes.error?.message;

    if (err) {
      return { ...empty, errorMessage: err };
    }

    const chargedUnitsRaw = chargedUnitsRpc.data;
    const n =
      typeof chargedUnitsRaw === "bigint"
        ? Number(chargedUnitsRaw)
        : typeof chargedUnitsRaw === "number"
          ? chargedUnitsRaw
          : typeof chargedUnitsRaw === "string"
            ? Number(chargedUnitsRaw)
            : Number(chargedUnitsRaw ?? 0);
    const chargedUnitsThisMonth = Number.isFinite(n) ? n : 0;

    const rawInvites = (invitesRes.data ?? []) as Array<{
      id: string;
      workspace_id: string;
      email: string;
      role: string;
      created_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
      expires_at: string;
      workspaces: { name: string } | { name: string }[] | null;
    }>;

    const recentInvites: AdminRecentInvite[] = rawInvites.map((row) => {
      const ws = row.workspaces;
      const name = Array.isArray(ws) ? ws[0]?.name : ws?.name;
      return {
        id: row.id,
        workspace_id: row.workspace_id,
        email: row.email,
        role: row.role,
        created_at: row.created_at,
        accepted_at: row.accepted_at,
        revoked_at: row.revoked_at,
        expires_at: row.expires_at,
        workspace_name: name ?? null,
      };
    });

    const rawPayments = (paymentsRes.data ?? []) as Array<{
      id: string;
      provider: string;
      event_type: string;
      created_at: string;
      user_id: string | null;
      payload: Record<string, unknown> | null;
    }>;

    const userIds = [...new Set(rawPayments.map((p) => p.user_id).filter(Boolean))] as string[];
    let emailByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: userRows } = await admin.from("users").select("id, email").in("id", userIds);
      for (const u of userRows ?? []) {
        if (u.id && u.email) emailByUserId[u.id] = u.email;
      }
    }

    const withEmail = (rows: typeof rawPayments): AdminPaymentEventRow[] =>
      rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        event_type: r.event_type,
        created_at: r.created_at,
        user_id: r.user_id,
        user_email: r.user_id ? emailByUserId[r.user_id] ?? null : null,
        payload: r.payload && typeof r.payload === "object" ? r.payload : {},
      }));

    const recentPaymentEvents = withEmail(rawPayments.slice(0, 12));
    const errorLikePaymentEvents = withEmail(
      rawPayments.filter((r) => isLikelyPaymentFailureEventType(r.event_type)).slice(0, 10)
    );

    const notifyRows = rawPayments.filter((r) =>
      isNotifyLikePaymentEvent({
        event_type: r.event_type,
        payload: r.payload && typeof r.payload === "object" ? r.payload : null,
      })
    );
    const recentBillingNotifyEvents = withEmail(notifyRows.slice(0, 10));

    const providerFailRows = rawPayments.filter(
      (r) =>
        isLikelyPaymentFailureEventType(r.event_type) &&
        String(r.provider ?? "")
          .trim()
          .toLowerCase() !== "app"
    );
    const recentProviderFailureEvents = withEmail(providerFailRows.slice(0, 10));

    const recentWorkspaces = (recentWsRes.data ?? []) as AdminRecentWorkspace[];

    const recentInternalOpsAudit = auditOut.error ? [] : auditOut.rows;

    const analysisOverview = await fetchAdminAnalysisOverview(admin);

    return {
      ok: true,
      errorMessage: null,
      yymm,
      periodStart,
      runtime: getInternalRuntimeStatus(),
      analysisOverview,
      totals: {
        userCount: userCountRes.count ?? 0,
        workspaceCount: wsCountRes.count ?? 0,
        sharedWorkspaceCount: sharedWorkspaceCount,
        analysesThisMonth: analysesRes.count ?? 0,
        chargedUnitsThisMonth,
      },
      recentWorkspaces,
      recentInvites,
      recentPaymentEvents,
      errorLikePaymentEvents,
      recentBillingNotifyEvents,
      recentProviderFailureEvents,
      recentInternalOpsAudit,
    };
  } catch (e) {
    return {
      ...empty,
      errorMessage: e instanceof Error ? e.message : "無法建立管理連線",
    };
  }
}
