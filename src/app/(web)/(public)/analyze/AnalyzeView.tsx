"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult, ImageDualTrackReport } from "@/types/analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HighlightedCopy } from "@/components/HighlightedCopy";
import { mergeIntervals } from "@/lib/text-spans";
import Link from "next/link";
import { FindingPanel } from "@/components/analyze/FindingPanel";
import { GuestConversionCard } from "@/components/analyze/GuestConversionCard";
import { toast } from "sonner";
import { useOptionalWorkspace } from "@/components/workspace/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { PdfReportSection } from "@/components/analyze/PdfReportSection";
import type { OcrDetailedResult } from "@/lib/ocr/tesseract-page-result";

type Tab = "text" | "image" | "pdf";

/** 依整頁代表信心（0–1）分級，供 UI 標示。 */
function ocrConfidenceTier(conf01: number): "高" | "中" | "低" {
  if (conf01 >= 0.75) return "高";
  if (conf01 >= 0.45) return "中";
  return "低";
}

function formatOcrPercent(conf01: number | null | undefined, explicitPercent?: number): string {
  if (explicitPercent != null && Number.isFinite(explicitPercent)) return `${Math.round(explicitPercent)}%`;
  if (conf01 == null || !Number.isFinite(conf01)) return "—";
  return `${Math.round(conf01 * 100)}%`;
}

function ImageDualTrackSummaryBlock({ report }: { report: ImageDualTrackReport }) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-secondary">摘要</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{report.visionSummary}</p>
      </div>
      {report.textPassSummary ? (
        <div className="space-y-2 rounded-lg border border-surface-border bg-canvas/80 p-3">
          <p className="text-xs font-medium text-ink-secondary">參考摘要</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{report.textPassSummary}</p>
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-secondary">辨識文字</p>
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-canvas p-3 text-sm text-ink">
          {report.ocrSupportText.trim() ? report.ocrSupportText : "（未附文字）"}
        </div>
      </div>
    </>
  );
}

export function AnalyzeView() {
  const wsCtx = useOptionalWorkspace();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageOcrText, setImageOcrText] = useState("");
  /** 與 `imageOcrText` 對應之最後一次引擎聚合原文（未套用顯示層字形優化），供除錯對照。 */
  const [imageOcrTextRaw, setImageOcrTextRaw] = useState("");
  /** 字形校正後、GPT 清理前（與引擎原文分開保存） */
  const [imageOcrTextDisplay, setImageOcrTextDisplay] = useState("");
  /** 最後一次 GPT 清理結果快照（送檢預設與編輯框初值） */
  const [imageOcrTextClean, setImageOcrTextClean] = useState("");
  /** 擷取完成後之字形顯示層說明（繁中） */
  const [imageOcrNormHintZh, setImageOcrNormHintZh] = useState<string | null>(null);
  /** GPT 清理層說明（繁中） */
  const [imageOcrGptHintZh, setImageOcrGptHintZh] = useState<string | null>(null);
  /** 最後一次 `/api/ocr/clean` 之機器可讀碼（成功為 GPT_CLEAN_OK） */
  const [imageOcrGptCleanCode, setImageOcrGptCleanCode] = useState<string | null>(null);
  /** 最後一次 GPT 清理之安全除錯訊息 */
  const [imageOcrGptCleanDebug, setImageOcrGptCleanDebug] = useState<string | null>(null);
  /** 最後一次「擷取文字」API 回傳之整頁代表信心（0–1）；手動編輯文字時仍保留供對照。 */
  const [imageOcrPreviewConfidence, setImageOcrPreviewConfidence] = useState<number | null>(null);
  const [imageOcrPreviewPercent, setImageOcrPreviewPercent] = useState<number | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrClientError, setOcrClientError] = useState<{ code: string; message: string } | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestBlocked, setGuestBlocked] = useState(false);

  const workspaceId = wsCtx?.selectedId ?? null;
  const workspaceLoading = Boolean(wsCtx?.loading);
  const activeWs = wsCtx?.workspaces.find((w) => w.id === workspaceId) ?? wsCtx?.workspaces[0];
  const yymm = new Date().toISOString().slice(0, 7);
  const used = activeWs && activeWs.usageMonth === yymm ? activeWs.unitsUsedMonth : 0;
  const remaining = activeWs ? Math.max(0, activeWs.monthlyQuotaUnits - used) : null;

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const mergedSpans = useMemo(() => {
    if (!result) return [];
    return mergeIntervals(result.findings.flatMap((f) => f.spans ?? []));
  }, [result]);

  const displayTextForHighlight = useMemo(() => {
    if (!result) return text;
    if (result.pdfReport && result.pdfReport.pages[0]) return result.pdfReport.pages[0].text;
    if (result.analyzedText) return result.analyzedText;
    return text;
  }, [result, text]);

  /** 圖片主軌：改寫 API 需同時帶入圖像摘要與 OCR 參考文字，避免只餵錯誤 OCR。 */
  const findingPanelFullText = useMemo(() => {
    if (!result) return text;
    if (result.meta.inputKind === "image" && result.imageDualTrack) {
      const vs = result.imageDualTrack.visionSummary.trim();
      const ocr = (result.analyzedText ?? "").trim();
      if (vs && vs !== "（無）" && ocr) return `${vs}\n\n${ocr}`;
      if (ocr) return ocr;
      if (vs && vs !== "（無）") return vs;
    }
    return displayTextForHighlight;
  }, [result, text, displayTextForHighlight]);

  async function ingestAfterBrowserOcr(detailed: OcrDetailedResult) {
    const raw = detailed.text ?? "";
    const display = detailed.textDisplay ?? raw;
    setImageOcrTextRaw(raw);
    setImageOcrTextDisplay(display);
    setImageOcrNormHintZh(detailed.displayNormalization?.labelZh ?? null);
    setImageOcrPreviewConfidence(detailed.confidence);
    setImageOcrPreviewPercent(detailed.confidencePercent);

    setOcrProgress(1);
    let clean = display;
    let gptHint: string | null = null;
    let gptCode: string | null = null;
    let gptDebug: string | null = null;
    try {
      const cleanRes = await fetch("/api/ocr/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text: display }),
      });
      const j = (await cleanRes.json().catch(() => ({}))) as {
        textClean?: string;
        labelZh?: string;
        code?: string;
        debugMessage?: string;
        error?: string;
      };
      if (cleanRes.ok) {
        if (typeof j.textClean === "string") {
          clean = j.textClean.trim() || display;
        }
        gptHint = typeof j.labelZh === "string" ? j.labelZh : null;
        gptCode = typeof j.code === "string" ? j.code : null;
        gptDebug = typeof j.debugMessage === "string" ? j.debugMessage : null;
      } else {
        gptHint = "後續整理未成功，已使用辨識結果。";
        gptCode = "GPT_CLEAN_UNKNOWN_ERROR";
        gptDebug = `HTTP ${cleanRes.status}${j.error ? `: ${j.error}` : ""}`.slice(0, 800);
      }
    } catch (netErr) {
      gptHint = "連線異常，已使用辨識結果。";
      gptCode = "GPT_CLEAN_UNKNOWN_ERROR";
      gptDebug =
        `[client] ${netErr instanceof Error ? `${netErr.name}: ${netErr.message}` : String(netErr)}`.slice(0, 800);
    }

    setImageOcrTextClean(clean);
    setImageOcrText(clean);
    setImageOcrGptHintZh(gptHint);
    setImageOcrGptCleanCode(gptCode);
    setImageOcrGptCleanDebug(gptDebug);

    if (typeof window !== "undefined" && gptCode && gptCode !== "GPT_CLEAN_OK") {
      console.warn("[ocr/clean]", gptCode, gptHint, gptDebug);
    }
    toast.success("掃描完成");
  }

  async function runOcrPreview() {
    if (!imageFile) {
      toast.error("請先選擇圖片");
      return;
    }
    setOcrBusy(true);
    setOcrClientError(null);
    setOcrProgress(0);
    const ocrMod = await import("@/lib/ocr/browser-ocr");
    try {
      const detailed = await ocrMod.runBrowserOcrDetailed(imageFile, {
        onProgress: (r) => setOcrProgress(r),
      });
      await ingestAfterBrowserOcr(detailed);
    } catch (e) {
      const err = ocrMod.formatBrowserOcrError(e);
      setOcrClientError(err);
      toast.error(err.message, { description: `代碼：${err.code}` });
    } finally {
      setOcrProgress(null);
      setOcrBusy(false);
    }
  }

  async function run() {
    setError(null);
    setResult(null);
    setGuestBlocked(false);
    setLoading(true);
    try {
      if (wsCtx && !workspaceId && !workspaceLoading) {
        setError("請選擇工作區（側欄可切換）。");
        toast.error("缺少工作區");
        return;
      }

      let res: Response;

      if (tab === "text") {
        if (!text.trim()) {
          setError("請輸入文案。");
          return;
        }
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            text,
            workspaceId: wsCtx ? workspaceId : undefined,
            kind: "text",
          }),
        });
      } else if (tab === "image") {
        if (!imageFile) {
          setError("請選擇圖片。");
          return;
        }
        const fd = new FormData();
        fd.append("kind", "image");
        fd.append("file", imageFile);
        if (workspaceId) fd.append("workspaceId", workspaceId);
        fd.append("ocrText", imageOcrText.trim());
        if (imageOcrPreviewConfidence != null) {
          fd.append("ocrConfidence", String(imageOcrPreviewConfidence));
        }
        res = await fetch("/api/analyze", { method: "POST", body: fd, credentials: "same-origin" });
      } else {
        if (!pdfFile) {
          setError("請選擇 PDF。");
          return;
        }
        const fd = new FormData();
        fd.append("kind", "pdf");
        fd.append("file", pdfFile);
        if (workspaceId) fd.append("workspaceId", workspaceId);
        res = await fetch("/api/analyze", { method: "POST", body: fd, credentials: "same-origin" });
      }

      const data = (await res.json()) as AnalysisResult & { error?: string; code?: string };
      if (!res.ok) {
        const msg = data.error ?? "分析失敗";
        const codePart = data.code ? `（代碼：${data.code}）` : "";
        setError(`${msg}${codePart}`);
        if (res.status === 403 && msg.includes("訪客")) {
          setGuestBlocked(true);
        }
        if (res.status === 429) {
          toast.error("共用審查額度已用完");
        } else if (res.status === 403) {
          toast.error("無法繼續檢測");
        } else {
          toast.error(msg);
        }
        return;
      }
      if ("findings" in data && Array.isArray(data.findings)) {
        setResult(data as AnalysisResult);
        toast.success("分析完成");
        await wsCtx?.refresh();
      } else {
        setError("回應格式錯誤");
        toast.error("回應格式錯誤");
      }
    } catch {
      setError("網路錯誤，請稍後再試。");
      toast.error("網路錯誤，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  const loggedIn = Boolean(wsCtx);

  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-24 pt-1">
      <div className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">分析工作區</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem] sm:leading-snug">合規檢測</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-secondary">
          支援文字、圖片與 PDF（依頁分析）。多帳號共用審查額度：文字／圖片各 1 點；PDF 依頁數扣點。
        </p>
      </div>

      {loggedIn && activeWs ? (
        <Card className="border-surface-border bg-white p-0">
          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{activeWs.name}</span>
                <Badge tone="blue">{activeWs.plan === "pro" ? "Pro" : "Free"}</Badge>
                <span className="text-xs text-ink-secondary">
                  {activeWs.role === "owner" ? "擁有者" : activeWs.role === "admin" ? "管理員" : "成員"}
                </span>
              </div>
              <Link href="/members" className="text-xs font-medium text-ink underline-offset-4 hover:underline">
                成員與共用審查額度
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">本月共用審查額度</p>
                <p className="mt-1.5 text-xl font-medium tabular-nums tracking-tight text-ink">{activeWs.monthlyQuotaUnits}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">本月已使用</p>
                <p className="mt-1.5 text-xl font-medium tabular-nums tracking-tight text-ink">{used}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-white px-4 py-3.5 ring-1 ring-black/[0.04]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">剩餘共用審查額度</p>
                <p className="mt-1.5 text-xl font-medium tabular-nums tracking-tight text-ink">{remaining ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {guestBlocked ? (
        <div className="space-y-3">
          <Card className="border-amber-200/80 bg-amber-50/40">
            <CardHeader>
              <CardTitle className="text-base font-medium text-amber-950">訪客免費檢測已使用</CardTitle>
              <CardDescription className="text-amber-900/75">
                註冊後可解鎖多帳號共用審查額度、圖片與 PDF 檢測與完整紀錄協作。
              </CardDescription>
            </CardHeader>
          </Card>
          <GuestConversionCard />
        </div>
      ) : null}

      <Card className="p-0">
        <CardHeader className="border-b border-surface-border px-5 py-5 sm:px-6">
          <CardTitle>輸入內容</CardTitle>
          <CardDescription>
            {tab === "image"
              ? "請上傳圖片，按「掃描圖片」辨識文字後可編輯，再按「開始檢測」。須登入並選擇工作區。"
              : "登入後使用工作區之共用審查額度。文字與 PDF 可依分頁操作。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-6 sm:px-6">
          <div className="flex flex-wrap gap-1.5">
            {(["text", "image", "pdf"] as const).map((k) => {
              const disabled = !loggedIn && k !== "text";
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setTab(k);
                    setError(null);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    tab === k
                      ? "bg-brand-strong text-white"
                      : "border border-surface-border bg-white text-ink-secondary hover:border-zinc-300 hover:text-ink"
                  } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  {k === "text" ? "文字" : k === "image" ? "圖片" : "PDF"}
                </button>
              );
            })}
          </div>
          {!loggedIn ? (
            <p className="text-xs text-ink-secondary">圖片與 PDF 需登入並使用共用審查額度。</p>
          ) : null}

          {tab === "text" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="貼上你的廣告文案…"
            />
          ) : null}

          {tab === "image" ? (
            <div className="space-y-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-lg file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setImageFile(f);
                  setImageOcrText("");
                  setImageOcrTextRaw("");
                  setImageOcrTextDisplay("");
                  setImageOcrTextClean("");
                  setImageOcrNormHintZh(null);
                  setImageOcrGptHintZh(null);
                  setImageOcrGptCleanCode(null);
                  setImageOcrGptCleanDebug(null);
                  setImageOcrPreviewConfidence(null);
                  setImageOcrPreviewPercent(null);
                  setOcrClientError(null);
                  setOcrProgress(null);
                }}
              />
              <p className="text-xs leading-relaxed text-ink-secondary">建議清晰圖片；上限 10MB。</p>
              {ocrClientError ? (
                <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
                  <p className="font-medium">掃描失敗</p>
                  <p className="mt-1 text-xs text-red-900/90">{ocrClientError.message}</p>
                  <p className="mt-1 text-[11px] text-red-800/80">代碼：{ocrClientError.code}</p>
                </div>
              ) : null}

              {imagePreviewUrl ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-secondary">原始圖片預覽</p>
                    <div className="relative flex max-h-64 justify-center overflow-hidden rounded-xl border border-surface-border bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreviewUrl} alt="上傳預覽" className="max-h-64 w-full object-contain object-top" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="secondary" size="sm" disabled={ocrBusy || !imageFile} onClick={() => void runOcrPreview()}>
                      掃描圖片
                    </Button>
                    {ocrBusy ? (
                      <span className="text-sm tabular-nums text-ink-secondary">掃描中 {Math.round((ocrProgress ?? 0) * 100)}%</span>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={imageOcrText}
                      onChange={(e) => {
                        setImageOcrText(e.target.value);
                        setImageOcrNormHintZh(null);
                        setImageOcrGptHintZh(null);
                        setImageOcrGptCleanCode(null);
                        setImageOcrGptCleanDebug(null);
                      }}
                      placeholder="掃描後可在此編輯辨識結果，或手動貼上／修正…"
                      className="min-h-[160px]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "pdf" ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="application/pdf"
                className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-lg file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-ink-secondary">依頁數自共用審查額度扣點（每頁 1 點），單檔最多 50 頁、20MB。</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={
                loading ||
                workspaceLoading ||
                (tab === "text" && !text.trim()) ||
                (tab === "image" && !imageFile) ||
                (tab === "pdf" && !pdfFile) ||
                (loggedIn && !workspaceId)
              }
              onClick={() => void run()}
            >
              {loading ? "分析中…" : "開始檢測"}
            </Button>
            <span className="text-xs text-ink-secondary">訪客僅支援文字檢測 1 次。</span>
          </div>
          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-900">
              {error}
              {error.includes("額度") ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/members"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-strong px-3 text-xs font-medium text-white transition hover:bg-brand-strong/90"
                  >
                    共用審查額度
                  </Link>
                  <Link
                    href="/billing"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200/90 bg-white px-3 text-xs font-medium text-red-900 transition hover:bg-white"
                  >
                    帳務方案
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {result ? (
        <div className="space-y-10">
          {result.meta.inputKind === "image" && imagePreviewUrl ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">圖片檢測結果</CardTitle>
                  <CardDescription>摘要與辨識文字如下；發現項目見下方。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-secondary">原始圖片預覽</p>
                    <div className="relative max-h-72 overflow-hidden rounded-xl border border-surface-border bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreviewUrl} alt="分析圖片" className="max-h-72 w-full object-contain object-top" />
                    </div>
                  </div>
                  <div className="space-y-6 text-sm">
                    {result.imageDualTrack ? (
                      <ImageDualTrackSummaryBlock report={result.imageDualTrack} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {!result.pdfReport ? <NonPdfInsightSummary result={result} /> : null}

          {result.pdfReport ? (
            <PdfReportSection
              report={result.pdfReport}
              aggregateSummary={result.summary}
              allowRegenerate={!result.meta.guest}
              unitsCharged={result.meta.unitsCharged}
            />
          ) : result.meta.inputKind === "image" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>總覽摘要</CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-ink-secondary">{result.summary}</CardDescription>
                </CardHeader>
              </Card>

              <div className="space-y-5">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">發現項目</h2>
                  <p className="text-xs text-ink-secondary">共 {result.findings.length} 項</p>
                </div>

                {result.findings.length === 0 ? (
                  <p className="text-sm text-ink-secondary">未偵測到明顯風險片段（仍不代表合規）。</p>
                ) : (
                  <div className="space-y-6">
                    {result.findings.map((f, idx) => (
                      <FindingPanel
                        key={`${f.riskyPhrase}-${idx}`}
                        finding={f}
                        fullText={findingPanelFullText}
                        allowRegenerate={!result.meta.guest}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                  <div className="space-y-2">
                    <CardTitle>對照文字</CardTitle>
                    <CardDescription>風險片語高亮對齊於此處文字（若掃描為空則可能無標示）。</CardDescription>
                  </div>
                  <MetaBadges
                    result={result}
                    imagePreviewConfidence01={imageOcrPreviewConfidence}
                    imagePreviewPercent={imageOcrPreviewPercent}
                    hideImageOcrConfidence
                  />
                </CardHeader>
                <CardContent className="rounded-2xl border border-surface-border bg-canvas p-5">
                  <HighlightedCopy text={displayTextForHighlight} spans={mergedSpans} />
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                  <div className="space-y-2">
                    <CardTitle>標示後原文</CardTitle>
                    <CardDescription>高亮為系統偵測到的風險片語位置（僅供參考）。</CardDescription>
                  </div>
                  <MetaBadges result={result} imagePreviewConfidence01={null} imagePreviewPercent={null} />
                </CardHeader>
                <CardContent className="rounded-2xl border border-surface-border bg-canvas p-5">
                  <HighlightedCopy text={displayTextForHighlight} spans={mergedSpans} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>總覽摘要</CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-ink-secondary">{result.summary}</CardDescription>
                </CardHeader>
              </Card>

              <div className="space-y-5">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">發現項目</h2>
                  <p className="text-xs text-ink-secondary">共 {result.findings.length} 項</p>
                </div>

                {result.findings.length === 0 ? (
                  <p className="text-sm text-ink-secondary">未偵測到明顯風險片段（仍不代表合規）。</p>
                ) : (
                  <div className="space-y-6">
                    {result.findings.map((f, idx) => (
                      <FindingPanel
                        key={`${f.riskyPhrase}-${idx}`}
                        finding={f}
                        fullText={displayTextForHighlight}
                        allowRegenerate={!result.meta.guest}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {result.meta.guest ? <GuestConversionCard /> : null}

          <details className="group rounded-xl border border-surface-border bg-white p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-ink outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                檢視 JSON
                <span className="text-xs font-medium text-ink-secondary group-open:hidden">展開</span>
                <span className="hidden text-xs font-medium text-ink-secondary group-open:inline">收合</span>
              </span>
            </summary>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function NonPdfInsightSummary({ result }: { result: AnalysisResult }) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const f of result.findings) {
    if (f.severity === "high") high += 1;
    else if (f.severity === "medium") medium += 1;
    else low += 1;
  }
  const kind = result.meta.inputKind;
  const units = result.meta.unitsCharged;

  return (
    <Card className="border-surface-border bg-white ring-1 ring-black/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">檢測摘要</CardTitle>
        <CardDescription>
          {kind === "image" ? "圖片" : "文字"} · 發現 {result.findings.length} 項風險片段
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-red-100 bg-red-50/50 px-3 py-3 text-center">
            <p className="text-[11px] font-medium text-red-900/80">高</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-red-950">{high}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/45 px-3 py-3 text-center">
            <p className="text-[11px] font-medium text-amber-900/80">中</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-950">{medium}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-canvas px-3 py-3 text-center">
            <p className="text-[11px] font-medium text-ink-secondary">低</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{low}</p>
          </div>
        </div>
        {units != null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/45 px-4 py-3 text-sm">
            <span className="font-medium text-emerald-950">本次扣點（共用審查額度）</span>
            <span className="text-2xl font-semibold tabular-nums text-emerald-950">{units}</span>
          </div>
        ) : null}
        <p className="text-xs text-ink-secondary">
          輸入類型：{kind === "image" ? "圖片" : "文字"} · 點數為工作區內多帳號共用。
        </p>
      </CardContent>
    </Card>
  );
}

function MetaBadges({
  result,
  imagePreviewConfidence01,
  imagePreviewPercent,
  hideImageOcrConfidence,
}: {
  result: AnalysisResult;
  imagePreviewConfidence01?: number | null;
  imagePreviewPercent?: number | null;
  hideImageOcrConfidence?: boolean;
}) {
  const showPreviewOcr =
    !hideImageOcrConfidence &&
    result.meta.inputKind === "image" &&
    result.meta.ocrConfidence == null &&
    imagePreviewConfidence01 != null;

  return (
    <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
      <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
        來源：{result.meta.source === "openai" ? "AI 分析" : "規則引擎"}
      </span>
      {result.meta.inputKind ? (
        <Badge tone="blue">{result.meta.inputKind === "pdf" ? "PDF" : result.meta.inputKind === "image" ? "圖片" : "文字"}</Badge>
      ) : null}
      {result.meta.unitsCharged != null ? (
        <span className="rounded-lg border border-emerald-200/90 bg-emerald-50/60 px-2.5 py-1 font-medium text-emerald-950">
          本次扣點 {result.meta.unitsCharged} 點
        </span>
      ) : null}
      {!hideImageOcrConfidence && result.meta.ocrConfidence != null ? (
        <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
          辨識信心 {formatOcrPercent(result.meta.ocrConfidence)}（{ocrConfidenceTier(result.meta.ocrConfidence)}）
        </span>
      ) : showPreviewOcr ? (
        <span className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2 py-1 text-amber-950">
          辨識信心 {formatOcrPercent(imagePreviewConfidence01, imagePreviewPercent ?? undefined)}（
          {ocrConfidenceTier(imagePreviewConfidence01)}）
        </span>
      ) : null}
      {result.meta.guest ? (
        <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700">訪客模式</span>
      ) : (
        <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
          剩餘共用審查額度：{result.meta.quotaRemaining ?? "—"}
        </span>
      )}
    </div>
  );
}
