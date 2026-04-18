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
          { error: "本月共用分析額度已用完，請調整配額或次月再試。" },
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

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    workspaceIdIn = typeof form.get("workspaceId") === "string" ? (form.get("workspaceId") as string) : null;
    const k = form.get("kind");
    if (k === "image" || k === "pdf" || k === "text") kind = k;
    const t = form.get("text");
    if (typeof t === "string") textIn = t;
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
      result = await runComplianceAnalysis(textIn.trim(), {
        guest: true,
        inputKind: "text",
      });
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

  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan ?? null;

  let result: AnalysisResult;
  let inputTextForLog = "";
  let units = 1;
  let pdfPageCount: number | null = null;

  if (kind === "text") {
    if (!textIn.trim()) {
      return NextResponse.json({ error: "請提供要檢測的文案。" }, { status: 400 });
    }
    const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "text", {
      mode: "text",
    });
    if (!consumed.ok) return consumed.response;

    result = await runComplianceAnalysis(textIn.trim(), {
      guest: false,
      plan,
      quotaRemaining: consumed.remaining,
      workspaceId,
      workspaceName: wsRow?.name ?? null,
      inputKind: "text",
      unitsCharged: 1,
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
    let ocr: { text: string; confidence: number };
    try {
      ocr = await ocrImageBuffer(buf);
    } catch (e) {
      console.error("ocr:", e);
      return NextResponse.json({ error: "圖片文字辨識失敗，請改用輸入文字或更清晰的圖檔。" }, { status: 422 });
    }
    if (!ocr.text.trim()) {
      return NextResponse.json({ error: "無法從圖片辨識出文字。" }, { status: 400 });
    }

    const consumed = await consumeWorkspace(supabase, workspaceId, user.id, 1, "image", {
      mode: "ocr",
      bytes: file.size,
    });
    if (!consumed.ok) return consumed.response;

    result = await runComplianceAnalysis(ocr.text, {
      guest: false,
      plan,
      quotaRemaining: consumed.remaining,
      workspaceId,
      workspaceName: wsRow?.name ?? null,
      inputKind: "image",
      unitsCharged: 1,
      ocrConfidence: ocr.confidence,
    });
    inputTextForLog = ocr.text.slice(0, 50_000);
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
    } catch (e) {
      console.error("pdf:", e);
      return NextResponse.json({ error: "無法解析 PDF。" }, { status: 422 });
    }

    if (!pages.length) {
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
        plan,
        quotaRemaining: consumed.remaining,
        workspaceId,
        workspaceName: wsRow?.name ?? null,
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

    result = {
      findings: flatFindings,
      summary,
      scannedAt: new Date().toISOString(),
      meta: {
        source: pdfEngine,
        guest: false,
        plan,
        quotaRemaining: consumed.remaining,
        workspaceId,
        workspaceName: wsRow?.name ?? null,
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
