import { createAdminClient } from "@/lib/supabase/admin";
import { parseAdminEmails } from "@/lib/admin/is-admin-email";
import { parseSuperAdminEmails } from "@/lib/admin/internal-ops-access";
import { isLikelyPaymentFailureEventType, isNotifyLikePaymentEvent } from "@/lib/admin/payment-event-signals";
import type { AdminPaymentEventRow } from "@/lib/admin/fetch-admin-home";
import { fetchRecentInternalOpsAuditLogs, type InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";

export type InternalSecuritySnapshot = {
  ok: boolean;
  errorMessage: string | null;
  superadminEmailCount: number;
  adminEmailCount: number;
  internalUsesAdminFallback: boolean;
  /** 近 7 日、高風險 tone 之帳務事件筆數（掃描最近 300 筆） */
  highRiskPaymentEventCount7d: number;
  /** 含帳務狀態寫入跡象之 notify 類事件（最近 15 筆） */
  recentSensitivePaymentEvents: AdminPaymentEventRow[];
  /** 內部營運稽核（最近寫入） */
  recentInternalOpsAudit: InternalOpsAuditRow[];
};

export async function fetchInternalSecuritySnapshot(): Promise<InternalSecuritySnapshot> {
  const empty: InternalSecuritySnapshot = {
    ok: false,
    errorMessage: null,
    superadminEmailCount: parseSuperAdminEmails().length,
    adminEmailCount: parseAdminEmails().length,
    internalUsesAdminFallback: parseSuperAdminEmails().length === 0 && parseAdminEmails().length > 0,
    highRiskPaymentEventCount7d: 0,
    recentSensitivePaymentEvents: [],
    recentInternalOpsAudit: [],
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, errorMessage: "未設定 SUPABASE_SERVICE_ROLE_KEY。" };
  }

  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const [paymentsRes, auditOut] = await Promise.all([
      admin
        .from("payment_events")
        .select("id, provider, event_type, created_at, user_id, payload")
        .order("created_at", { ascending: false })
        .limit(300),
      fetchRecentInternalOpsAuditLogs(admin, 25),
    ]);

    const { data: rows, error } = paymentsRes;

    if (error) {
      return { ...empty, errorMessage: error.message };
    }

    const raw = (rows ?? []) as Array<{
      id: string;
      provider: string;
      event_type: string;
      created_at: string;
      user_id: string | null;
      payload: Record<string, unknown> | null;
    }>;

    const userIds = [...new Set(raw.map((p) => p.user_id).filter(Boolean))] as string[];
    let emailByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: userRows } = await admin.from("users").select("id, email").in("id", userIds);
      for (const u of userRows ?? []) {
        if (u.id && u.email) emailByUserId[u.id] = u.email;
      }
    }

    const toRow = (r: (typeof raw)[0]): AdminPaymentEventRow => ({
      id: r.id,
      provider: r.provider,
      event_type: r.event_type,
      created_at: r.created_at,
      user_id: r.user_id,
      user_email: r.user_id ? emailByUserId[r.user_id] ?? null : null,
      payload: r.payload && typeof r.payload === "object" ? r.payload : {},
    });

    const highRiskPaymentEventCount7d = raw.filter(
      (r) => r.created_at >= since && isLikelyPaymentFailureEventType(r.event_type)
    ).length;

    const sensitive = raw
      .filter((r) =>
        isNotifyLikePaymentEvent({
          event_type: r.event_type,
          payload: r.payload && typeof r.payload === "object" ? r.payload : null,
        })
      )
      .slice(0, 15)
      .map(toRow);

    const recentInternalOpsAudit = auditOut.error ? [] : auditOut.rows;

    return {
      ok: true,
      errorMessage: null,
      superadminEmailCount: parseSuperAdminEmails().length,
      adminEmailCount: parseAdminEmails().length,
      internalUsesAdminFallback: parseSuperAdminEmails().length === 0 && parseAdminEmails().length > 0,
      highRiskPaymentEventCount7d,
      recentSensitivePaymentEvents: sensitive,
      recentInternalOpsAudit,
    };
  } catch (e) {
    return {
      ...empty,
      errorMessage: e instanceof Error ? e.message : "載入失敗",
    };
  }
}
