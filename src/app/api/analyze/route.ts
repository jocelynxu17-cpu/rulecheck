import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runComplianceAnalysis } from "@/lib/analyze/run-compliance";
import { extractPdfPages, pdfUnitsFromPageCount } from "@/lib/content-extract/pdf-pages";
import { IMAGE_MAX_BYTES, ocrImageBuffer, PDF_MAX_BYTES } from "@/lib/content-extract/image-ocr";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve-workspace";
import type { AnalysisInputKind, AnalysisResult, PdfPageAnalysis } from "@/types/analysis";
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

export async function POST(request: Request) {
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

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    workspaceIdIn = typeof form.get("workspaceId") === "string" ? (form.get("workspaceId") as string) : null;
    const k = form.get("kind");
    if (k === "image" || k === "pdf" || k === "text") kind = k;
    const t = form.get("text");
    if (typeof t === "string") textIn = t;
    const ocrT = form.get("ocrText");
    if (typeof ocrT === "string") ocrTextOverride = ocrT;
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
      console.log("[analyze] guest text", { inputLength: t.length });
      result = await runComplianceAnalysis(t, {
        guest: true,
        inputKind: "text",
      });
      console.log("[analyze] guest result", { findingsCount: result.findings.length, source: result.meta?.source });
    } catch (e) {
      console.error("guest analyze:", e);
      return NextResponse.json({ error: "分析失敗" }, { status: 500 });
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

  if (kind === "text") {
    if (!textIn.trim()) {
      return NextResponse.json({ error: "請提供要檢測的文案。" }, { status: 400 });
    }
    const textTrim = textIn.trim();
    console.log("[analyze] text path", { inputLength: textTrim.length });
    const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "text", {
      mode: "text",
    });
    if (!consumed.ok) return consumed.response;

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
    result = { ...result, analyzedText: textTrim };
    console.log("[analyze] text result", {
      findingsCount: result.findings.length,
      source: result.meta?.source,
    });
    inputTextForLog = textIn.slice(0, 50_000);
  } else if (kind === "image") {
    if (!file) {
      return NextResponse.json({ error: "請上傳圖片檔。" }, { status: 400 });
    }
    if (file.size > IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "圖片檔過大（上限 10MB）。" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());

    let textForAnalysis: string;
    let ocrConfidence: number | null = null;
    const trimmedOverride = ocrTextOverride.trim();

    if (trimmedOverride) {
      textForAnalysis = trimmedOverride;
      console.log("[analyze] image path", { mode: "ocr_edited", ocrTextLength: textForAnalysis.length, fileBytes: file.size });
    } else {
      let ocr: { text: string; confidence: number };
      try {
        ocr = await ocrImageBuffer(buf);
      } catch (e) {
        console.error("[analyze] OCR failure:", e);
        return NextResponse.json({ error: "圖片文字辨識失敗，請改用輸入文字或更清晰的圖檔。" }, { status: 422 });
      }
      console.log("[analyze] image path", {
        mode: "ocr",
        ocrTextLength: ocr.text.length,
        ocrConfidence: ocr.confidence,
        fileBytes: file.size,
      });
      if (!ocr.text.trim()) {
        console.error("[analyze] OCR returned empty text");
        return NextResponse.json({ error: "無法從圖片辨識出文字。" }, { status: 400 });
      }
      textForAnalysis = ocr.text;
      ocrConfidence = ocr.confidence;
    }

    const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "image", {
      mode: trimmedOverride ? "ocr_edited" : "ocr",
      bytes: file.size,
    });
    if (!consumed.ok) return consumed.response;

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
    result = { ...result, analyzedText: textForAnalysis };
    console.log("[analyze] image analysis done", {
      findingsCount: result.findings.length,
      source: result.meta?.source,
    });
    inputTextForLog = textForAnalysis.slice(0, 50_000);
  } else {
    if (!file) {
      return NextResponse.json({ error: "請上傳 PDF。" }, { status: 400 });
    }
    if (file.size > PDF_MAX_BYTES) {
      return NextResponse.json({ error: "PDF 檔過大（上限 20MB）。" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    let pages: { pageNumber: number; text: string }[];
    let pageCount: number;
    try {
      const extracted = await extractPdfPages(buf);
      pages = extracted.pages;
      pageCount = pdfUnitsFromPageCount(extracted.pageCount);
      console.log("[analyze] PDF extracted", {
        pageCount,
        pagesReturned: pages.length,
        firstPageTextLength: pages[0]?.text?.length ?? 0,
        fileBytes: file.size,
      });
    } catch (e) {
      console.error("[analyze] PDF parse failure:", e);
      return NextResponse.json({ error: "無法解析 PDF。" }, { status: 422 });
    }

    if (!pages.length) {
      console.error("[analyze] PDF no pages after extract");
      return NextResponse.json({ error: "PDF 無可讀文字。" }, { status: 400 });
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
      const pageAnalysis = await runComplianceAnalysis(p.text, {
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
  }

  const normalized: AnalysisResult = kind === "pdf" ? normalizeAnalysisResult(result, inputTextForLog) : result;

  const { error: logError } = await supabase.from("analysis_logs").insert({
    user_id: user.id,
    workspace_id: workspaceId,
    input_text: inputTextForLog,
    input_type: kind,
    units_charged: units,
    pdf_page_count: pdfPageCount,
    result: normalized as unknown as Record<string, unknown>,
  });
  if (logError) console.error("analysis_logs insert:", logError.message);

  return NextResponse.json(normalized);
}
