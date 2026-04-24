import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runComplianceAnalysis } from "@/lib/analyze/run-compliance";
import { analyzeTextMock } from "@/lib/analyzer-mock";
import { IMAGE_MAX_BYTES, PDF_MAX_BYTES } from "@/lib/analyze/input-limits";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve-workspace";
import type { AnalysisInputKind, AnalysisMeta, AnalysisResult, PdfPageAnalysis } from "@/types/analysis";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import { GUEST_ANALYSIS_COOKIE } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

type ConsumePayload = {
  ok?: boolean;
  remaining?: number;
  quota?: number;
  error?: string;
};

/** 目前分析目標工作區之帳務欄位（SSOT，來自 `workspaces`）。 */
type WorkspaceBillingForAnalysis = {
  name: string;
  plan: string | null;
  monthly_quota_units: number | null;
  subscription_status: string | null;
  billing_provider: string | null;
};

function analysisWorkspaceMeta(ws: WorkspaceBillingForAnalysis | null) {
  if (!ws) {
    return {
      plan: null as string | null,
      workspaceMonthlyQuotaUnits: null as number | null,
      workspaceSubscriptionStatus: null as string | null,
      workspaceBillingProvider: null as string | null,
      workspaceName: null as string | null,
    };
  }
  return {
    plan: ws.plan ?? null,
    workspaceMonthlyQuotaUnits: ws.monthly_quota_units ?? null,
    workspaceSubscriptionStatus: ws.subscription_status ?? null,
    workspaceBillingProvider: ws.billing_provider ?? null,
    workspaceName: ws.name,
  };
}

function guestCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  };
}

async function consumeWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
  units: number,
  inputType: AnalysisInputKind,
  meta: Record<string, unknown>
) {
  const { data: rpcData, error: rpcError } = await supabase.rpc("consume_workspace_units", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_units: units,
    p_input_type: inputType,
    p_metadata: meta,
  });

  if (rpcError) {
    console.error("consume_workspace_units:", rpcError.message);
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "無法確認工作區配額，請確認資料庫已套用最新 migration。" },
        { status: 503 }
      ),
    };
  }

  const row = rpcData as ConsumePayload | null;
  if (row && row.ok === false) {
    if (row.error === "quota_exceeded") {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: "本月共用審查額度已用完，請調整配額或次月再試。" },
          { status: 429 }
        ),
      };
    }
    return {
      ok: false as const,
      response: NextResponse.json({ error: "無法使用工作區共用配額。" }, { status: 403 }),
    };
  }

  const remaining = row && row.ok ? (typeof row.remaining === "number" ? row.remaining : null) : null;
  return { ok: true as const, remaining };
}

function errPayload(message: string, code: string, details?: Record<string, unknown>) {
  return { error: message, code, ...(details ? { details } : {}) };
}

/** Only if `runComplianceAnalysis` throws (e.g. normalize); OpenAI failure is handled inside that pipeline. */
function ruleOnlyFallback(text: string, metaPatch: Partial<AnalysisMeta>): AnalysisResult {
  const raw = analyzeTextMock(text);
  const normalized = normalizeAnalysisResult(raw, text);
  return { ...normalized, meta: { ...normalized.meta, ...metaPatch } };
}

function logCaught(prefix: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(prefix, {
    message: err.message,
    name: err.name,
    stack: err.stack ?? "",
  });
}

export async function POST(request: Request) {
  try {
    return await postAnalyze(request);
  } catch (e) {
    logCaught("[analyze] uncaught (returning JSON)", e);
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json(
      errPayload("分析請求處理失敗", "INTERNAL_ERROR", {
        message: err.message,
        stack: err.stack?.slice(0, 1200) ?? "",
      }),
      { status: 500 }
    );
  }
}

async function postAnalyze(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const contentType = request.headers.get("content-type") ?? "";

  let workspaceIdIn: string | null = null;
  let kind: AnalysisInputKind = "text";
  let textIn = "";
  let file: File | null = null;

  let ocrTextOverride = "";
  /** 客戶端瀏覽器 OCR 之整頁信心（0–1），與 ocrText 一併送出時寫入 meta。 */
  let ocrConfidenceClient: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    workspaceIdIn = typeof form.get("workspaceId") === "string" ? (form.get("workspaceId") as string) : null;
    const k = form.get("kind");
    if (k === "image" || k === "pdf" || k === "text") kind = k;
    const t = form.get("text");
    if (typeof t === "string") textIn = t;
    const ocrT = form.get("ocrText");
    if (typeof ocrT === "string") ocrTextOverride = ocrT;
    const ocrConf = form.get("ocrConfidence");
    if (typeof ocrConf === "string" && ocrConf.trim()) ocrConfidenceClient = ocrConf.trim();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
    }
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    workspaceIdIn = typeof b.workspaceId === "string" ? b.workspaceId : null;
    if (b.kind === "image" || b.kind === "pdf" || b.kind === "text") kind = b.kind;
    textIn = typeof b.text === "string" ? b.text : "";
  }

  if (!user) {
    if (cookieStore.get(GUEST_ANALYSIS_COOKIE)?.value === "1") {
      return NextResponse.json(
        { error: "訪客免費次數已使用完畢，請註冊或登入以繼續檢測。" },
        { status: 403 }
      );
    }
    if (kind !== "text" || !textIn.trim()) {
      return NextResponse.json({ error: "訪客僅支援文字檢測。" }, { status: 400 });
    }
    let result: AnalysisResult;
    try {
      const t = textIn.trim();
      console.log("[analyze] branch", { kind, branch: "guest_text", inputLength: t.length });
      try {
        result = await runComplianceAnalysis(t, { guest: true, inputKind: "text" });
      } catch (e) {
        logCaught("[analyze] guest GPT pipeline threw, rule-only fallback", e);
        result = ruleOnlyFallback(t, { guest: true, inputKind: "text" });
      }
      console.log("[analyze] guest result", {
        findingsCount: result.findings.length,
        source: result.meta?.source,
      });
    } catch (e) {
      logCaught("[analyze] guest text failure", e);
      return NextResponse.json(
        errPayload("文字分析失敗", "GUEST_TEXT_FAILED", {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }),
        { status: 500 }
      );
    }
    const normalized = normalizeAnalysisResult(result, textIn);
    const res = NextResponse.json(normalized);
    res.cookies.set(GUEST_ANALYSIS_COOKIE, "1", guestCookieOptions());
    return res;
  }

  const ws = await resolveWorkspaceForUser(supabase, user.id, workspaceIdIn);
  if (!ws.ok) {
    return NextResponse.json({ error: ws.error }, { status: 400 });
  }
  const workspaceId = ws.workspaceId;

  const { data: wsBillingRaw } = await supabase
    .from("workspaces")
    .select("name, plan, monthly_quota_units, subscription_status, billing_provider")
    .eq("id", workspaceId)
    .maybeSingle();

  const wsBilling = wsBillingRaw as WorkspaceBillingForAnalysis | null;
  const wb = analysisWorkspaceMeta(wsBilling);

  let result: AnalysisResult;
  let inputTextForLog = "";
  let units = 1;
  let pdfPageCount: number | null = null;
  /** Temporary production diagnostics (see `[analyze] pipeline`). */
  let logOcrTextLength: number | null = null;
  let logPdfExtractedPages: number | null = null;

  if (kind === "text") {
    if (!textIn.trim()) {
      return NextResponse.json({ error: "請提供要檢測的文案。" }, { status: 400 });
    }
    const textTrim = textIn.trim();
    console.log("[analyze] branch", { kind, branch: "text", inputLength: textTrim.length });
    try {
      const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "text", {
        mode: "text",
      });
      if (!consumed.ok) return consumed.response;

      try {
        result = await runComplianceAnalysis(textTrim, {
          guest: false,
          plan: wb.plan,
          workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
          workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
          workspaceBillingProvider: wb.workspaceBillingProvider,
          quotaRemaining: consumed.remaining,
          workspaceId,
          workspaceName: wb.workspaceName,
          inputKind: "text",
          unitsCharged: 1,
        });
      } catch (e) {
        logCaught("[analyze] text GPT pipeline threw, rule-only fallback", e);
        result = ruleOnlyFallback(textTrim, {
          guest: false,
          plan: wb.plan,
          workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
          workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
          workspaceBillingProvider: wb.workspaceBillingProvider,
          quotaRemaining: consumed.remaining,
          workspaceId,
          workspaceName: wb.workspaceName,
          inputKind: "text",
          unitsCharged: 1,
        });
      }
      result = { ...result, analyzedText: textTrim };
      console.log("[analyze] text result", {
        findingsCount: result.findings.length,
        source: result.meta?.source,
      });
    } catch (e) {
      logCaught("[analyze] text branch failure", e);
      return NextResponse.json(
        errPayload("文字分析失敗", "TEXT_ANALYSIS_FAILED", {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }),
        { status: 500 }
      );
    }
    inputTextForLog = textIn.slice(0, 50_000);
  } else if (kind === "image") {
    console.log("[analyze] branch", { kind, branch: "image" });
    try {
      if (!file) {
        return NextResponse.json(errPayload("請上傳圖片檔。", "IMAGE_NO_FILE"), { status: 400 });
      }
      if (file.size > IMAGE_MAX_BYTES) {
        return NextResponse.json(errPayload("圖片檔過大（上限 10MB）。", "IMAGE_TOO_LARGE"), { status: 400 });
      }
      const trimmedOverride = ocrTextOverride.trim();
      if (!trimmedOverride) {
        return NextResponse.json(
          errPayload(
            "請先於此頁按「擷取文字（瀏覽器 OCR）」取得文字並確認內容，再送交檢測（避免伺服器逾時）。",
            "IMAGE_OCR_TEXT_REQUIRED"
          ),
          { status: 400 }
        );
      }

      let textForAnalysis = trimmedOverride;
      let ocrConfidence: number | null = null;
      if (ocrConfidenceClient) {
        const n = parseFloat(ocrConfidenceClient);
        if (Number.isFinite(n)) {
          ocrConfidence = n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n));
        }
      }
      logOcrTextLength = textForAnalysis.length;
      console.log("[analyze] image path", {
        mode: "client_ocr",
        ocrTextLength: textForAnalysis.length,
        ocrConfidence,
        fileBytes: file.size,
      });

      const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "image", {
        mode: "ocr_browser",
        bytes: file.size,
      });
      if (!consumed.ok) return consumed.response;

      try {
        result = await runComplianceAnalysis(textForAnalysis, {
          guest: false,
          plan: wb.plan,
          workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
          workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
          workspaceBillingProvider: wb.workspaceBillingProvider,
          quotaRemaining: consumed.remaining,
          workspaceId,
          workspaceName: wb.workspaceName,
          inputKind: "image",
          unitsCharged: 1,
          ocrConfidence,
        });
      } catch (e) {
        logCaught("[analyze] image GPT pipeline threw, rule-only fallback", e);
        result = ruleOnlyFallback(textForAnalysis, {
          guest: false,
          plan: wb.plan,
          workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
          workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
          workspaceBillingProvider: wb.workspaceBillingProvider,
          quotaRemaining: consumed.remaining,
          workspaceId,
          workspaceName: wb.workspaceName,
          inputKind: "image",
          unitsCharged: 1,
          ocrConfidence,
        });
      }
      result = { ...result, analyzedText: textForAnalysis };
      console.log("[analyze] image analysis done", {
        findingsCount: result.findings.length,
        source: result.meta?.source,
      });
      inputTextForLog = textForAnalysis.slice(0, 50_000);
    } catch (e) {
      logCaught("[analyze] image branch failure", e);
      return NextResponse.json(
        errPayload("圖片分析失敗", "IMAGE_ANALYSIS_FAILED", {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }),
        { status: 500 }
      );
    }
  } else {
    console.log("[analyze] branch", { kind, branch: "pdf" });
    try {
      if (!file) {
        return NextResponse.json(errPayload("請上傳 PDF。", "PDF_NO_FILE"), { status: 400 });
      }
      if (file.size > PDF_MAX_BYTES) {
        return NextResponse.json(errPayload("PDF 檔過大（上限 20MB）。", "PDF_TOO_LARGE"), { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      let pages: { pageNumber: number; text: string }[];
      let pageCount: number;
      try {
        const { extractPdfPages, pdfUnitsFromPageCount } = await import("@/lib/content-extract/pdf-pages");
        const extracted = await extractPdfPages(buf);
        pages = extracted.pages;
        pageCount = pdfUnitsFromPageCount(extracted.pageCount);
        logPdfExtractedPages = pages.length;
        console.log("[analyze] PDF extracted", {
          pageCount,
          pagesReturned: pages.length,
          firstPageTextLength: pages[0]?.text?.length ?? 0,
          fileBytes: file.size,
        });
      } catch (e) {
        logCaught("[analyze] PDF parse failure", e);
        const err = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json(
          errPayload("PDF 解析暫時不可用，請改匯出純文字或圖片後再試。", "PDF_PARSE_UNAVAILABLE", {
            message: err.message,
            stack: err.stack?.slice(0, 1200) ?? "",
            name: err.name,
          }),
          { status: 503 }
        );
      }

      if (!pages.length) {
        console.error("[analyze] PDF no pages after extract");
        return NextResponse.json(errPayload("PDF 無可讀文字。", "PDF_NO_TEXT"), { status: 400 });
      }

      units = pageCount;
      pdfPageCount = pageCount;

      const consumed = await consumeWorkspace(supabase, workspaceId, user.id, units, "pdf", {
        pages: pageCount,
        file: file.name,
      });
      if (!consumed.ok) return consumed.response;

      const pageResults: PdfPageAnalysis[] = [];
      const riskyPageNumbers: number[] = [];
      const flatFindings: AnalysisResult["findings"] = [];
      let pdfEngine: "openai" | "mock" = "mock";

      for (const p of pages) {
        let pageAnalysis: AnalysisResult;
        try {
          pageAnalysis = await runComplianceAnalysis(p.text, {
            guest: false,
            plan: wb.plan,
            workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
            workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
            workspaceBillingProvider: wb.workspaceBillingProvider,
            quotaRemaining: consumed.remaining,
            workspaceId,
            workspaceName: wb.workspaceName,
            inputKind: "pdf",
            unitsCharged: units,
          });
        } catch (e) {
          logCaught(`[analyze] PDF page ${p.pageNumber} GPT pipeline threw, rule-only fallback`, e);
          pageAnalysis = ruleOnlyFallback(p.text, {
            guest: false,
            plan: wb.plan,
            workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
            workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
            workspaceBillingProvider: wb.workspaceBillingProvider,
            quotaRemaining: consumed.remaining,
            workspaceId,
            workspaceName: wb.workspaceName,
            inputKind: "pdf",
            unitsCharged: units,
          });
        }
        if (pageAnalysis.meta.source === "openai") pdfEngine = "openai";
        const hasRisk = pageAnalysis.findings.length > 0;
        if (hasRisk) riskyPageNumbers.push(p.pageNumber);
        flatFindings.push(...pageAnalysis.findings);
        pageResults.push({
          pageNumber: p.pageNumber,
          text: p.text,
          findings: pageAnalysis.findings,
          summary: pageAnalysis.summary,
          hasRisk,
        });
      }

      const summary =
        pageResults.length === 1
          ? pageResults[0].summary
          : `共 ${pageCount} 頁；${riskyPageNumbers.length ? `有風險頁：${riskyPageNumbers.join("、")}` : "未偵測到明顯風險頁（仍不代表整份文件合規）。"}`;

      console.log("[analyze] PDF analysis done", {
        pageCount,
        findingsCount: flatFindings.length,
        pdfEngine,
      });

      result = {
        findings: flatFindings,
        summary,
        scannedAt: new Date().toISOString(),
        meta: {
          source: pdfEngine,
          guest: false,
          plan: wb.plan,
          workspaceMonthlyQuotaUnits: wb.workspaceMonthlyQuotaUnits,
          workspaceSubscriptionStatus: wb.workspaceSubscriptionStatus,
          workspaceBillingProvider: wb.workspaceBillingProvider,
          quotaRemaining: consumed.remaining,
          workspaceId,
          workspaceName: wb.workspaceName,
          inputKind: "pdf",
          unitsCharged: units,
        },
        pdfReport: {
          pageCount,
          pages: pageResults,
          riskyPageNumbers,
        },
      };
      inputTextForLog = `[PDF ${file.name} ${pageCount}頁] ${pages[0]?.text?.slice(0, 500) ?? ""}`;
    } catch (e) {
      logCaught("[analyze] PDF branch failure", e);
      const err = e instanceof Error ? e : new Error(String(e));
      return NextResponse.json(
        errPayload("PDF 分析失敗", "PDF_ANALYSIS_FAILED", {
          message: err.message,
          stack: err.stack?.slice(0, 1200) ?? "",
        }),
        { status: 500 }
      );
    }
  }

  const normalized: AnalysisResult = kind === "pdf" ? normalizeAnalysisResult(result, inputTextForLog) : result;

  const branch = kind === "text" ? "text" : kind === "image" ? "image" : "pdf";
  console.log("[analyze] pipeline", {
    kind,
    branch,
    source: normalized.meta?.source ?? null,
    ocrTextLength: logOcrTextLength,
    pdfExtractedPageCount: logPdfExtractedPages,
    findingsCount: normalized.findings.length,
  });

  try {
    const { error: logError } = await supabase.from("analysis_logs").insert({
      user_id: user.id,
      workspace_id: workspaceId,
      input_text: inputTextForLog,
      input_type: kind,
      units_charged: units,
      pdf_page_count: pdfPageCount,
      result: normalized as unknown as Record<string, unknown>,
    });
    if (logError) console.error("[analyze] analysis_logs insert:", logError.message);
  } catch (e) {
    logCaught("[analyze] analysis_logs insert threw", e);
  }

  return NextResponse.json(normalized);
}
