import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminPaymentEventDetail } from "@/lib/admin/load-payment-events";
import { filterPaymentEventsForWorkspace } from "@/lib/admin/payment-events-workspace-scope";
import type { AdminWorkspaceRange } from "@/lib/admin/workspace-admin-range";
import { sinceIsoForWorkspaceRange } from "@/lib/admin/workspace-admin-range";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import { analysisStatusLabel } from "@/lib/analysis-normalize";
import { paymentEventOutcomeTone } from "@/lib/admin/payment-event-ui";
import {
  collectAnalysisOpsHintsFromResult,
  mergeHintLabels,
} from "@/lib/admin/workspace-analysis-ops-hints";

export type AdminWorkspaceDetailRow = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  monthly_quota_units: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  units_used_month: number;
  usage_month: string;
  created_at: string;
  created_by: string | null;
};

export type AdminWorkspaceMemberRow = {
  user_id: string;
  role: string;
  created_at: string;
  email: string | null;
};

export type AdminWorkspaceUsageEventRow = {
  id: string;
  user_id: string;
  input_type: string;
  units_charged: number;
  created_at: string;
};

export type AdminWorkspaceAnalysisRow = {
  id: string;
  created_at: string;
  input_type: string | null;
  units_charged: number | null;
  user_id: string;
  findings_count: number;
  /** 規則後備／OCR／PDF 等提示摘要 */
  ops_hints_line: string | null;
};

export type UsageSummaryBucket = { events: number; units: number };

export type AdminWorkspaceUsageByInputType = {
  text: UsageSummaryBucket;
  image: UsageSummaryBucket;
  pdf: UsageSummaryBucket;
  other: UsageSummaryBucket;
};

export type AdminWorkspaceMemberUsageRank = {
  user_id: string;
  email: string | null;
  units_used: number;
  analysis_count: number;
};

export type AdminWorkspaceRiskFindingCounts = {
  high: number;
  medium: number;
  low: number;
  analyses_with_any_finding: number;
};

export type AdminWorkspaceRiskyAnalysisRow = {
  id: string;
  created_at: string;
  high_count: number;
  medium_count: number;
  low_count: number;
  status_label: string;
};

/** 區間內掃描樣本（最多 800 筆分析之 result）得來的營運信號；非全量統計。 */
export type AdminWorkspaceOperationalSignals = {
  rows_scanned: number;
  rows_with_mock_pipeline: number;
  rows_with_low_ocr_hint: number;
  rows_with_pdf_text_gap_hint: number;
  rows_with_image_ocr_short_hint: number;
};

export type AdminWorkspaceDetailPayload = {
  range: AdminWorkspaceRange;
  sinceIso: string;
  workspace: AdminWorkspaceDetailRow | null;
  members: AdminWorkspaceMemberRow[];
  operationalSignals: AdminWorkspaceOperationalSignals;
  usageByInputType: AdminWorkspaceUsageByInputType;
  memberUsageRanking: AdminWorkspaceMemberUsageRank[];
  riskFindingCounts: AdminWorkspaceRiskFindingCounts;
  riskyAnalysesRecent: AdminWorkspaceRiskyAnalysisRow[];
  analysesRiskTruncated: boolean;
  usageEvents: AdminWorkspaceUsageEventRow[];
  analyses: AdminWorkspaceAnalysisRow[];
  paymentEvents: AdminPaymentEventDetail[];
  /** 篩選後、時間區間內：金流結果為失敗／需留意 */
  anomalyPaymentEvents: AdminPaymentEventDetail[];
  /** 篩選後、時間區間內：訂閱／發票／Checkout 等生命週期事件（供對照帳務狀態） */
  billingLifecyclePaymentEvents: AdminPaymentEventDetail[];
  usageEventsTruncated: boolean;
  /** 分析次數僅統計前 N 筆（區間內） */
  analysisCountTruncated: boolean;
  error: string | null;
};

/** 區間內用量事件拉取上限（摘要與排行以此為準）。 */
export const WORKSPACE_ADMIN_USAGE_EVENTS_CAP = 5000;
const ANALYSIS_IDS_FOR_COUNT_CAP = 5000;
const ANALYSIS_RESULT_FOR_RISK_CAP = 800;

function normalizeUsageInputKey(raw: string): keyof AdminWorkspaceUsageByInputType {
  const t = raw.trim().toLowerCase();
  if (t === "text") return "text";
  if (t === "image") return "image";
  if (t === "pdf") return "pdf";
  return "other";
}

function emptyBuckets(): AdminWorkspaceUsageByInputType {
  return {
    text: { events: 0, units: 0 },
    image: { events: 0, units: 0 },
    pdf: { events: 0, units: 0 },
    other: { events: 0, units: 0 },
  };
}

function isBillingLifecycleEventType(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return /subscription|invoice\.|checkout\.session|payment_intent\.|charge\.|customer\./.test(t);
}

export async function loadWorkspaceAdminDetail(
  workspaceId: string,
  range: AdminWorkspaceRange
): Promise<AdminWorkspaceDetailPayload> {
  const sinceIso = sinceIsoForWorkspaceRange(range);
  const emptyOperationalSignals: AdminWorkspaceOperationalSignals = {
    rows_scanned: 0,
    rows_with_mock_pipeline: 0,
    rows_with_low_ocr_hint: 0,
    rows_with_pdf_text_gap_hint: 0,
    rows_with_image_ocr_short_hint: 0,
  };

  const emptyBase = {
    range,
    sinceIso,
    workspace: null,
    members: [] as AdminWorkspaceMemberRow[],
    operationalSignals: emptyOperationalSignals,
    usageByInputType: emptyBuckets(),
    memberUsageRanking: [] as AdminWorkspaceMemberUsageRank[],
    riskFindingCounts: {
      high: 0,
      medium: 0,
      low: 0,
      analyses_with_any_finding: 0,
    } satisfies AdminWorkspaceRiskFindingCounts,
    riskyAnalysesRecent: [] as AdminWorkspaceRiskyAnalysisRow[],
    analysesRiskTruncated: false,
    usageEvents: [] as AdminWorkspaceUsageEventRow[],
    analyses: [] as AdminWorkspaceAnalysisRow[],
    paymentEvents: [] as AdminPaymentEventDetail[],
    anomalyPaymentEvents: [] as AdminPaymentEventDetail[],
    billingLifecyclePaymentEvents: [] as AdminPaymentEventDetail[],
    usageEventsTruncated: false,
    analysisCountTruncated: false,
    error: null as string | null,
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...emptyBase, error: "未設定 SUPABASE_SERVICE_ROLE_KEY。" };
  }

  try {
    const admin = createAdminClient();

    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .select(
        "id, name, plan, subscription_status, billing_provider, monthly_quota_units, current_period_end, cancel_at_period_end, units_used_month, usage_month, created_at, created_by"
      )
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsErr) {
      return { ...emptyBase, error: wsErr.message };
    }
    if (!ws) {
      return { ...emptyBase, error: "not_found" };
    }

    const { data: memRows, error: memErr } = await admin
      .from("workspace_members")
      .select(
        `
        user_id,
        role,
        created_at,
        users ( email )
      `
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      return { ...emptyBase, error: memErr.message };
    }

    const members: AdminWorkspaceMemberRow[] = (memRows ?? []).map((row: Record<string, unknown>) => {
      const u = row.users as { email: string | null } | { email: string | null }[] | null;
      const email = Array.isArray(u) ? u[0]?.email ?? null : u?.email ?? null;
      return {
        user_id: row.user_id as string,
        role: row.role as string,
        created_at: row.created_at as string,
        email,
      };
    });

    const memberUserIds = new Set(members.map((m) => m.user_id));
    const emailByUserId = new Map(members.map((m) => [m.user_id, m.email]));

    const { data: usageAll, error: useErr, count: usageCount } = await admin
      .from("usage_events")
      .select("id, user_id, input_type, units_charged, created_at", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(WORKSPACE_ADMIN_USAGE_EVENTS_CAP);

    if (useErr) {
      return { ...emptyBase, error: useErr.message };
    }

    const usageRows = (usageAll ?? []) as AdminWorkspaceUsageEventRow[];
    const usageEventsTruncated = (usageCount ?? usageRows.length) > WORKSPACE_ADMIN_USAGE_EVENTS_CAP;

    const usageByInputType = emptyBuckets();
    const unitsByUser = new Map<string, number>();
    for (const u of usageRows) {
      const key = normalizeUsageInputKey(u.input_type);
      usageByInputType[key].events += 1;
      usageByInputType[key].units += Number(u.units_charged) || 0;
      unitsByUser.set(u.user_id, (unitsByUser.get(u.user_id) ?? 0) + (Number(u.units_charged) || 0));
    }

    const { data: anaCountRows, error: anaCountErr } = await admin
      .from("analysis_logs")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .gte("created_at", sinceIso)
      .limit(ANALYSIS_IDS_FOR_COUNT_CAP);

    if (anaCountErr) {
      return { ...emptyBase, error: anaCountErr.message };
    }

    const analysisCountTruncated = (anaCountRows?.length ?? 0) >= ANALYSIS_IDS_FOR_COUNT_CAP;

    const analysisCountByUser = new Map<string, number>();
    for (const row of anaCountRows ?? []) {
      const uid = (row as { user_id: string }).user_id;
      if (!uid) continue;
      analysisCountByUser.set(uid, (analysisCountByUser.get(uid) ?? 0) + 1);
    }

    const allRankUserIds = new Set<string>([
      ...memberUserIds,
      ...unitsByUser.keys(),
      ...analysisCountByUser.keys(),
    ]);

    const memberUsageRanking: AdminWorkspaceMemberUsageRank[] = [...allRankUserIds]
      .map((user_id) => ({
        user_id,
        email: emailByUserId.get(user_id) ?? null,
        units_used: unitsByUser.get(user_id) ?? 0,
        analysis_count: analysisCountByUser.get(user_id) ?? 0,
      }))
      .filter((r) => r.units_used > 0 || r.analysis_count > 0)
      .sort((a, b) => {
        if (b.units_used !== a.units_used) return b.units_used - a.units_used;
        return b.analysis_count - a.analysis_count;
      });

    const { data: anaRecent, error: anaErr } = await admin
      .from("analysis_logs")
      .select("id, created_at, input_type, units_charged, user_id, input_text, result")
      .eq("workspace_id", workspaceId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(40);

    if (anaErr) {
      return { ...emptyBase, error: anaErr.message };
    }

    const analysesMapped: AdminWorkspaceAnalysisRow[] = (anaRecent ?? []).map((raw) => {
      const row = raw as {
        id: string;
        created_at: string;
        input_type: string | null;
        units_charged: number | null;
        user_id: string;
        input_text: string | null;
        result: unknown;
      };
      const norm = normalizeAnalysisResult(row.result, row.input_text ?? "");
      const hints = collectAnalysisOpsHintsFromResult(row.result, row.input_text ?? "", row.input_type);
      return {
        id: row.id,
        created_at: row.created_at,
        input_type: row.input_type,
        units_charged: row.units_charged,
        user_id: row.user_id,
        findings_count: norm.findings.length,
        ops_hints_line: hints.length ? mergeHintLabels(hints) : null,
      };
    });

    const { data: anaRiskRows, error: anaRiskErr } = await admin
      .from("analysis_logs")
      .select("id, created_at, input_text, input_type, result")
      .eq("workspace_id", workspaceId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(ANALYSIS_RESULT_FOR_RISK_CAP);

    if (anaRiskErr) {
      return { ...emptyBase, error: anaRiskErr.message };
    }

    const riskRows = anaRiskRows ?? [];
    const analysesRiskTruncated = riskRows.length >= ANALYSIS_RESULT_FOR_RISK_CAP;

    const operationalSignals: AdminWorkspaceOperationalSignals = {
      rows_scanned: riskRows.length,
      rows_with_mock_pipeline: 0,
      rows_with_low_ocr_hint: 0,
      rows_with_pdf_text_gap_hint: 0,
      rows_with_image_ocr_short_hint: 0,
    };

    let high = 0;
    let medium = 0;
    let low = 0;
    let analyses_with_any_finding = 0;
    const riskyScratch: AdminWorkspaceRiskyAnalysisRow[] = [];

    for (const row of riskRows as {
      id: string;
      created_at: string;
      input_text: string;
      input_type: string | null;
      result: unknown;
    }[]) {
      const hintList = collectAnalysisOpsHintsFromResult(row.result, row.input_text ?? "", row.input_type);
      if (hintList.some((h) => h.includes("後備"))) operationalSignals.rows_with_mock_pipeline += 1;
      if (hintList.some((h) => h.includes("OCR 信心偏低"))) operationalSignals.rows_with_low_ocr_hint += 1;
      if (hintList.some((h) => h.includes("PDF") && h.includes("頁無文字")))
        operationalSignals.rows_with_pdf_text_gap_hint += 1;
      if (hintList.some((h) => h.includes("圖片文字軌"))) operationalSignals.rows_with_image_ocr_short_hint += 1;

      const result = normalizeAnalysisResult(row.result, row.input_text ?? "");
      const findings = result.findings;
      if (findings.length) analyses_with_any_finding += 1;

      let hc = 0;
      let mc = 0;
      let lc = 0;
      for (const f of findings) {
        if (f.severity === "high") hc += 1;
        else if (f.severity === "medium") mc += 1;
        else lc += 1;
      }
      high += hc;
      medium += mc;
      low += lc;

      if (hc > 0 || mc > 0) {
        riskyScratch.push({
          id: row.id,
          created_at: row.created_at,
          high_count: hc,
          medium_count: mc,
          low_count: lc,
          status_label: analysisStatusLabel(findings),
        });
      }
    }

    const riskyAnalysesRecent = riskyScratch.slice(0, 15);

    const { data: payRows, error: payErr } = await admin
      .from("payment_events")
      .select(
        `
        id,
        provider,
        event_type,
        created_at,
        user_id,
        subscription_id,
        idempotency_key,
        payload,
        users ( email )
      `
      )
      .order("created_at", { ascending: false })
      .limit(400);

    if (payErr) {
      return { ...emptyBase, error: payErr.message };
    }

    const rawPay = (payRows ?? []) as Record<string, unknown>[];
    const mappedPayments: AdminPaymentEventDetail[] = rawPay.map((row) => {
      const users = row.users as { email: string | null } | { email: string | null }[] | null;
      const email = Array.isArray(users) ? users[0]?.email ?? null : users?.email ?? null;
      const payload = (row.payload as Record<string, unknown>) ?? {};
      return {
        id: row.id as string,
        provider: row.provider as string,
        event_type: row.event_type as string,
        created_at: row.created_at as string,
        user_id: (row.user_id as string | null) ?? null,
        subscription_id: (row.subscription_id as string | null) ?? null,
        idempotency_key: String(row.idempotency_key ?? ""),
        payload,
        user_email: email,
      };
    });
    const workspacePayments = filterPaymentEventsForWorkspace(mappedPayments, workspaceId, memberUserIds);

    const sinceMs = new Date(sinceIso).getTime();
    const inRange = (ev: AdminPaymentEventDetail) => new Date(ev.created_at).getTime() >= sinceMs;

    const paymentEvents = workspacePayments.slice(0, 40);

    const anomalyPaymentEvents = workspacePayments
      .filter(inRange)
      .filter((ev) => {
        const tone = paymentEventOutcomeTone(ev.event_type);
        return tone === "red" || tone === "amber";
      })
      .slice(0, 25);

    const billingLifecyclePaymentEvents = workspacePayments
      .filter(inRange)
      .filter((ev) => isBillingLifecycleEventType(ev.event_type))
      .slice(0, 20);

    return {
      range,
      sinceIso,
      workspace: ws as AdminWorkspaceDetailRow,
      members,
      operationalSignals,
      usageByInputType,
      memberUsageRanking,
      riskFindingCounts: { high, medium, low, analyses_with_any_finding },
      riskyAnalysesRecent,
      analysesRiskTruncated,
      usageEvents: usageRows.slice(0, 40),
      analyses: analysesMapped,
      paymentEvents,
      anomalyPaymentEvents,
      billingLifecyclePaymentEvents,
      usageEventsTruncated,
      analysisCountTruncated,
      error: null,
    };
  } catch (e) {
    return { ...emptyBase, error: e instanceof Error ? e.message : "載入失敗" };
  }
}
