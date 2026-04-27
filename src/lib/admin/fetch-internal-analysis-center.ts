import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectAnalysisOpsHintsFromResult,
  mergeHintLabels,
} from "@/lib/admin/workspace-analysis-ops-hints";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import type { AdminWorkspaceRange } from "@/lib/admin/workspace-admin-range";
import { parseWorkspaceAdminRange, sinceIsoForWorkspaceRange, workspaceRangeLabelZh } from "@/lib/admin/workspace-admin-range";
import { isLikelyPaymentFailureEventType } from "@/lib/admin/payment-event-signals";
import { INTERNAL_PAYMENT_BATCH_SCAN_MAX } from "@/lib/admin/internal-scale-conventions";
import { loadPaymentEvents } from "@/lib/admin/load-payment-events";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 單次掃描上限（用於分布、提示、熱點工作區）；超過則標示為抽樣。 */
export const ANALYSIS_OPS_SCAN_CAP = 3500;

const TABLE_FETCH_MAX = 600;
export const ANALYSIS_TABLE_OUTPUT_CAP = 90;

export type AnalysisSignalFilter = "all" | "fallback" | "abnormal" | "risk";

export type InternalAnalysisFilters = {
  range: AdminWorkspaceRange;
  sinceIso: string;
  rangeLabelZh: string;
  inputType: "text" | "image" | "pdf" | null;
  workspaceId: string | null;
  userIds: string[] | null;
  pipeline: "openai" | "mock" | null;
  signal: AnalysisSignalFilter;
};

export type TypeBreakdownInScan = {
  volume: number;
  openai: number;
  mock: number;
  /** 本類型列中至少一則營運提示的筆數 */
  withHints: number;
  topHintLine: string | null;
};

export type IssueBucketCounts = {
  ocrLowOrCleanup: number;
  pdfNoTextLayer: number;
  imageLowOcrTrack: number;
  mockPipelineRows: number;
};

export type ImpactedWorkspaceRow = {
  workspace_id: string;
  workspace_name: string | null;
  signal_score: number;
  /** 該區間掃描內：mock 或含提示的最新時間 */
  last_signal_at: string | null;
};

export type ExtendedAdminAnalysisLogRow = {
  id: string;
  created_at: string;
  workspace_id: string | null;
  user_id: string;
  input_type: string | null;
  units_charged: number | null;
  pdf_page_count: number | null;
  user_email: string | null;
  workspace_name: string | null;
  findingsCount: number;
  source: string | null;
  inputKind: string | null;
  ops_hints_line: string | null;
  is_guest: boolean;
};

export type InternalAnalysisCenterPayload = {
  filters: InternalAnalysisFilters;
  /** 區間內 exact 計數（head） */
  countsExact: {
    total: number;
    text: number;
    image: number;
    pdf: number;
    unknown: number;
  };
  scan: {
    rowsScanned: number;
    scanCapped: boolean;
  };
  health: {
    normalAiHits: number;
    fallbackMockHits: number;
    abnormalSignalHits: number;
    interpretationZh: string;
  };
  byType: {
    text: TypeBreakdownInScan;
    image: TypeBreakdownInScan;
    pdf: TypeBreakdownInScan;
    unknown: TypeBreakdownInScan;
  };
  issueBuckets: IssueBucketCounts;
  providerPaymentFailuresInRange: number;
  impactedWorkspaces: ImpactedWorkspaceRow[];
  tableRows: ExtendedAdminAnalysisLogRow[];
  tableTruncationNote: string | null;
  userFilterNote: string | null;
};

function guestFromResult(result: unknown): boolean {
  const r = result as { meta?: { guest?: boolean } } | null;
  return Boolean(r?.meta?.guest);
}

function sourceFromResult(result: unknown): string | null {
  const r = result as { meta?: { source?: string } } | null;
  const s = r?.meta?.source;
  return typeof s === "string" ? s : null;
}

function categorizeIssueBuckets(hints: string[]): IssueBucketCounts {
  let ocrLowOrCleanup = 0;
  let pdfNoTextLayer = 0;
  let imageLowOcrTrack = 0;
  let mockPipelineRows = 0;
  for (const h of hints) {
    if (h.includes("後備")) mockPipelineRows += 1;
    if (h.includes("OCR 信心偏低")) ocrLowOrCleanup += 1;
    if (h.includes("PDF") && h.includes("頁無文字")) pdfNoTextLayer += 1;
    if (h.includes("圖片文字軌")) imageLowOcrTrack += 1;
  }
  return { ocrLowOrCleanup, pdfNoTextLayer, imageLowOcrTrack, mockPipelineRows };
}

function mergeIssueBuckets(a: IssueBucketCounts, b: IssueBucketCounts): IssueBucketCounts {
  return {
    ocrLowOrCleanup: a.ocrLowOrCleanup + b.ocrLowOrCleanup,
    pdfNoTextLayer: a.pdfNoTextLayer + b.pdfNoTextLayer,
    imageLowOcrTrack: a.imageLowOcrTrack + b.imageLowOcrTrack,
    mockPipelineRows: a.mockPipelineRows + b.mockPipelineRows,
  };
}

function emptyTypeBreakdown(): TypeBreakdownInScan {
  return { volume: 0, openai: 0, mock: 0, withHints: 0, topHintLine: null };
}

/** 營運判讀短文（Traditional Chinese） */
export function buildAnalysisHealthInterpretationZh(params: {
  scanRows: number;
  totalExact: number;
  fallbackRateInScan: number;
  abnormalRateInScan: number;
  scanCapped: boolean;
  providerPaymentFailures: number;
}): string {
  const parts: string[] = [];
  if (params.scanRows === 0) {
    return "此區間內尚無分析紀錄，無法評估健康度。";
  }
  if (params.scanCapped) {
    parts.push(`以下比例係依最近 ${params.scanRows} 筆抽樣（區間內總筆數約 ${params.totalExact}），目的為快速巡檢，非精算報表。`);
  }
  if (params.fallbackRateInScan > 0.35) {
    parts.push(
      `規則／後備管線占比約 ${Math.round(params.fallbackRateInScan * 100)}%，偏高；建議排查 OpenAI 連線、逾時與輸入是否屢屬無法送入模型之情形。`
    );
  } else if (params.fallbackRateInScan > 0.12) {
    parts.push(
      `後備管線約 ${Math.round(params.fallbackRateInScan * 100)}%，屬需留意區間；請對照下方「類型分布」是否集中在特定輸入（例如大量 PDF／圖片）。`
    );
  } else {
    parts.push(`後備管線占比約 ${Math.round(params.fallbackRateInScan * 100)}%，整體以 OpenAI 路徑為主。`);
  }

  if (params.abnormalRateInScan > 0.2) {
    parts.push(
      `含 OCR／PDF 文字層／圖片軌等提示之紀錄約 ${Math.round(params.abnormalRateInScan * 100)}%，需留意來源檔案品質與客戶操作習慣。`
    );
  } else if (params.abnormalRateInScan > 0.05) {
    parts.push(`另有約 ${Math.round(params.abnormalRateInScan * 100)}% 分析帶有品質或管線提示，建議搭配「受影響工作區」交叉查看。`);
  }

  if (params.providerPaymentFailures > 0) {
    parts.push(`同期帳務事件中有 ${params.providerPaymentFailures} 筆被標為失敗／高風險類型（見下方帳務區），請與訂閱狀態對照。`);
  }

  return parts.join(" ");
}

function firstString(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function parseInternalAnalysisFilters(sp: Record<string, string | string[] | undefined>): InternalAnalysisFilters {
  const range = parseWorkspaceAdminRange(sp.range);
  const sinceIso = sinceIsoForWorkspaceRange(range);
  const rangeLabelZh = workspaceRangeLabelZh(range);

  const typeRaw = firstString(sp, "type");
  const inputType =
    typeRaw === "text" || typeRaw === "image" || typeRaw === "pdf" ? typeRaw : null;

  const wsRaw = firstString(sp, "workspace");
  const workspaceId = UUID_RE.test(wsRaw) ? wsRaw : null;

  const pipeRaw = firstString(sp, "pipeline");
  const pipeline = pipeRaw === "openai" || pipeRaw === "mock" ? pipeRaw : null;

  const sigRaw = firstString(sp, "signal");
  const signal: AnalysisSignalFilter =
    sigRaw === "fallback" || sigRaw === "abnormal" || sigRaw === "risk" ? sigRaw : "all";

  return {
    range,
    sinceIso,
    rangeLabelZh,
    inputType,
    workspaceId,
    userIds: null,
    pipeline,
    signal,
  };
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function resolveUserIdsFilter(admin: SupabaseClient, raw: string): Promise<{ ids: string[] | null; note: string | null }> {
  const t = raw.trim();
  if (!t) return { ids: null, note: null };
  if (UUID_RE.test(t)) return { ids: [t], note: null };
  if (t.includes("@")) {
    const esc = escapeIlikePattern(t);
    const { data, error } = await admin.from("users").select("id").ilike("email", `%${esc}%`).limit(25);
    if (error) return { ids: null, note: `使用者查詢失敗：${error.message}` };
    const ids = (data ?? []).map((r) => r.id as string).filter(Boolean);
    if (ids.length === 0) return { ids: [], note: "找不到符合 Email 的使用者。" };
    if (ids.length > 1) return { ids, note: `多筆符合（${ids.length}），表格將篩為此清單。` };
    return { ids, note: null };
  }
  return { ids: null, note: "使用者請輸入 UUID 或含 @ 的 Email 關鍵字。" };
}

export async function fetchInternalAnalysisCenter(
  admin: SupabaseClient,
  sp: Record<string, string | string[] | undefined>
): Promise<InternalAnalysisCenterPayload> {
  const parsed = parseInternalAnalysisFilters(sp);
  const userRaw = firstString(sp, "user");
  const { ids: resolvedUserIds, note: userFilterNote } = await resolveUserIdsFilter(admin, userRaw);

  const filters: InternalAnalysisFilters = {
    ...parsed,
    userIds: resolvedUserIds === undefined ? null : resolvedUserIds,
  };

  const sinceIso = filters.sinceIso;

  const emptyPayload = (msg?: string): InternalAnalysisCenterPayload => ({
    filters,
    countsExact: { total: 0, text: 0, image: 0, pdf: 0, unknown: 0 },
    scan: { rowsScanned: 0, scanCapped: false },
    health: {
      normalAiHits: 0,
      fallbackMockHits: 0,
      abnormalSignalHits: 0,
      interpretationZh: msg ?? "無法載入資料。",
    },
    byType: {
      text: emptyTypeBreakdown(),
      image: emptyTypeBreakdown(),
      pdf: emptyTypeBreakdown(),
      unknown: emptyTypeBreakdown(),
    },
    issueBuckets: { ocrLowOrCleanup: 0, pdfNoTextLayer: 0, imageLowOcrTrack: 0, mockPipelineRows: 0 },
    providerPaymentFailuresInRange: 0,
    impactedWorkspaces: [],
    tableRows: [],
    tableTruncationNote: null,
    userFilterNote: userFilterNote ?? null,
  });

  if (resolvedUserIds && resolvedUserIds.length === 0) {
    return emptyPayload("此使用者條件下無符合帳號，請調整搜尋。");
  }

  try {
    const [
      totalRes,
      textRes,
      imageRes,
      pdfRes,
      unknownRes,
      scanRes,
      payPack,
    ] = await Promise.all([
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", sinceIso),
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", sinceIso).eq("input_type", "text"),
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", sinceIso).eq("input_type", "image"),
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", sinceIso).eq("input_type", "pdf"),
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", sinceIso).is("input_type", null),
      admin
        .from("analysis_logs")
        .select("id, created_at, workspace_id, user_id, input_type, input_text, result, units_charged, pdf_page_count")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(ANALYSIS_OPS_SCAN_CAP),
      loadPaymentEvents({ limit: 450, maxLimit: INTERNAL_PAYMENT_BATCH_SCAN_MAX }),
    ]);

    const qErr =
      totalRes.error?.message ??
      textRes.error?.message ??
      imageRes.error?.message ??
      pdfRes.error?.message ??
      unknownRes.error?.message ??
      scanRes.error?.message;

    if (qErr) {
      return emptyPayload(qErr);
    }

    const totalExact = totalRes.count ?? 0;
    const scanRows = (scanRes.data ?? []) as Array<{
      id: string;
      created_at: string;
      workspace_id: string | null;
      user_id: string;
      input_type: string | null;
      input_text: string | null;
      result: unknown;
      units_charged: number | null;
      pdf_page_count: number | null;
    }>;
    const scanCapped = totalExact > ANALYSIS_OPS_SCAN_CAP;

    const sinceMs = new Date(sinceIso).getTime();
    const providerPaymentFailuresInRange = payPack.rows.filter(
      (r) => new Date(r.created_at).getTime() >= sinceMs && isLikelyPaymentFailureEventType(r.event_type)
    ).length;

    let normalAiHits = 0;
    let fallbackMockHits = 0;
    let abnormalSignalHits = 0;

    const byType = {
      text: emptyTypeBreakdown(),
      image: emptyTypeBreakdown(),
      pdf: emptyTypeBreakdown(),
      unknown: emptyTypeBreakdown(),
    };

    let issueTotal: IssueBucketCounts = {
      ocrLowOrCleanup: 0,
      pdfNoTextLayer: 0,
      imageLowOcrTrack: 0,
      mockPipelineRows: 0,
    };

    const hintTallyByType: Record<string, Map<string, number>> = {
      text: new Map(),
      image: new Map(),
      pdf: new Map(),
      unknown: new Map(),
    };

    const wsSignals = new Map<
      string,
      { score: number; lastAt: string | null }
    >();

    for (const row of scanRows) {
      const src = sourceFromResult(row.result);
      const guest = guestFromResult(row.result);
      const hints = collectAnalysisOpsHintsFromResult(row.result, row.input_text ?? "", row.input_type);
      const hintsLine = mergeHintLabels(hints);
      const hasHints = hints.length > 0;
      const isMock = src === "mock";

      if (src === "openai") normalAiHits += 1;
      else if (isMock) fallbackMockHits += 1;

      if (hasHints) abnormalSignalHits += 1;

      const ib = categorizeIssueBuckets(hints);
      issueTotal = mergeIssueBuckets(issueTotal, ib);

      const key =
        row.input_type === "text"
          ? "text"
          : row.input_type === "image"
            ? "image"
            : row.input_type === "pdf"
              ? "pdf"
              : "unknown";
      const tb = byType[key];
      tb.volume += 1;
      if (src === "openai") tb.openai += 1;
      if (isMock) tb.mock += 1;
      if (hasHints) {
        tb.withHints += 1;
        const primary = hints[0] ?? "";
        if (primary) {
          hintTallyByType[key].set(primary, (hintTallyByType[key].get(primary) ?? 0) + 1);
        }
      }

      const wid = row.workspace_id;
      if (wid && (isMock || hasHints)) {
        const prev = wsSignals.get(wid) ?? { score: 0, lastAt: null };
        prev.score += isMock ? 2 : 1;
        if (hasHints) prev.score += 1;
        const t = row.created_at;
        if (!prev.lastAt || new Date(t) > new Date(prev.lastAt)) prev.lastAt = t;
        wsSignals.set(wid, prev);
      }
    }

    for (const k of ["text", "image", "pdf", "unknown"] as const) {
      const m = hintTallyByType[k];
      let top: string | null = null;
      let topN = 0;
      for (const [label, n] of m.entries()) {
        if (n > topN) {
          topN = n;
          top = label;
        }
      }
      byType[k].topHintLine = topN > 0 ? `${top}（約 ${topN} 次）` : null;
    }

    const scanned = scanRows.length || 1;
    const interpretationZh = buildAnalysisHealthInterpretationZh({
      scanRows: scanRows.length,
      totalExact,
      fallbackRateInScan: fallbackMockHits / scanned,
      abnormalRateInScan: abnormalSignalHits / scanned,
      scanCapped,
      providerPaymentFailures: providerPaymentFailuresInRange,
    });

    const impactedIds = [...wsSignals.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 18)
      .map(([id]) => id);

    let nameByWs: Record<string, string> = {};
    if (impactedIds.length) {
      const { data: wss } = await admin.from("workspaces").select("id, name").in("id", impactedIds);
      for (const w of wss ?? []) {
        if (w.id && w.name) nameByWs[w.id as string] = w.name as string;
      }
    }

    const impactedWorkspaces: ImpactedWorkspaceRow[] = impactedIds.map((wid) => {
      const s = wsSignals.get(wid)!;
      return {
        workspace_id: wid,
        workspace_name: nameByWs[wid] ?? null,
        signal_score: s.score,
        last_signal_at: s.lastAt,
      };
    });

    /** 表格：受篩選器影響的較深查詢 */
    let tq = admin
      .from("analysis_logs")
      .select("id, created_at, workspace_id, user_id, input_type, input_text, result, units_charged, pdf_page_count")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(TABLE_FETCH_MAX);

    if (filters.inputType) {
      tq = tq.eq("input_type", filters.inputType);
    }
    if (filters.workspaceId) {
      tq = tq.eq("workspace_id", filters.workspaceId);
    }
    if (filters.userIds && filters.userIds.length === 1) {
      tq = tq.eq("user_id", filters.userIds[0]);
    } else if (filters.userIds && filters.userIds.length > 1) {
      tq = tq.in("user_id", filters.userIds);
    }

    const { data: tableRaw, error: tableErr } = await tq;
    if (tableErr) {
      return emptyPayload(tableErr.message);
    }

    const rawTable = (tableRaw ?? []) as typeof scanRows;
    const userIdsForEmail = [...new Set(rawTable.map((r) => r.user_id))];
    const wsIdsForName = [...new Set(rawTable.map((r) => r.workspace_id).filter(Boolean))] as string[];

    let emailByUserId: Record<string, string> = {};
    if (userIdsForEmail.length) {
      const { data: users } = await admin.from("users").select("id, email").in("id", userIdsForEmail);
      for (const u of users ?? []) {
        if (u.id && u.email) emailByUserId[u.id as string] = u.email as string;
      }
    }
    let nameByWsId: Record<string, string> = {};
    if (wsIdsForName.length) {
      const { data: wss } = await admin.from("workspaces").select("id, name").in("id", wsIdsForName);
      for (const w of wss ?? []) {
        if (w.id && w.name) nameByWsId[w.id as string] = w.name as string;
      }
    }

    const mapped: ExtendedAdminAnalysisLogRow[] = rawTable.map((row) => {
      const res = row.result as { findings?: unknown[]; meta?: { source?: string; inputKind?: string; guest?: boolean } } | null;
      const findings = Array.isArray(res?.findings) ? res!.findings!.length : 0;
      const hints = collectAnalysisOpsHintsFromResult(row.result, row.input_text ?? "", row.input_type);
      const norm = normalizeAnalysisResult(row.result, row.input_text ?? "");
      return {
        id: row.id,
        created_at: row.created_at,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        input_type: row.input_type,
        units_charged: row.units_charged,
        pdf_page_count: row.pdf_page_count,
        user_email: emailByUserId[row.user_id] ?? null,
        workspace_name: row.workspace_id ? nameByWsId[row.workspace_id] ?? null : null,
        findingsCount: findings,
        source: res?.meta?.source ?? null,
        inputKind: res?.meta?.inputKind ?? row.input_type,
        ops_hints_line: hints.length ? mergeHintLabels(hints) : null,
        is_guest: Boolean(norm.meta.guest),
      };
    });

    let filtered = mapped;
    if (filters.pipeline === "openai") {
      filtered = filtered.filter((r) => r.source === "openai");
    } else if (filters.pipeline === "mock") {
      filtered = filtered.filter((r) => r.source === "mock");
    }

    if (filters.signal === "fallback") {
      filtered = filtered.filter((r) => r.source === "mock");
    } else if (filters.signal === "abnormal") {
      filtered = filtered.filter((r) => Boolean(r.ops_hints_line && r.ops_hints_line !== "—"));
    } else if (filters.signal === "risk") {
      filtered = filtered.filter(
        (r) => r.source === "mock" || Boolean(r.ops_hints_line && r.ops_hints_line !== "—")
      );
    }

    const tableTruncationNote =
      filtered.length > ANALYSIS_TABLE_OUTPUT_CAP
        ? `篩選後列僅顯示前 ${ANALYSIS_TABLE_OUTPUT_CAP} 筆（由最多 ${TABLE_FETCH_MAX} 筆後端抓取再篩選）。`
        : rawTable.length >= TABLE_FETCH_MAX
          ? `已達單次載入上限 ${TABLE_FETCH_MAX} 筆；若未見預期列，請縮小時間區間或加上工作區／使用者條件。`
          : null;

    const tableRows = filtered.slice(0, ANALYSIS_TABLE_OUTPUT_CAP);

    return {
      filters,
      countsExact: {
        total: totalExact,
        text: textRes.count ?? 0,
        image: imageRes.count ?? 0,
        pdf: pdfRes.count ?? 0,
        unknown: unknownRes.count ?? 0,
      },
      scan: { rowsScanned: scanRows.length, scanCapped },
      health: {
        normalAiHits,
        fallbackMockHits,
        abnormalSignalHits,
        interpretationZh,
      },
      byType,
      issueBuckets: issueTotal,
      providerPaymentFailuresInRange,
      impactedWorkspaces,
      tableRows,
      tableTruncationNote,
      userFilterNote,
    };
  } catch (e) {
    return emptyPayload(e instanceof Error ? e.message : "載入失敗");
  }
}
