"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
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

type Tab = "text" | "image" | "pdf";

type OcrPreviewLine = { text: string; confidence: number; confidencePercent: number };
type OcrPreviewBlock = {
  text: string;
  confidence: number;
  confidencePercent: number;
  lineCount: number;
  lines: OcrPreviewLine[];
};

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

export function AnalyzeView() {
  const wsCtx = useOptionalWorkspace();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageOcrText, setImageOcrText] = useState("");
  /** 最後一次「擷取文字」API 回傳之整頁代表信心（0–1）；手動編輯文字時仍保留供對照。 */
  const [imageOcrPreviewConfidence, setImageOcrPreviewConfidence] = useState<number | null>(null);
  const [imageOcrPreviewPercent, setImageOcrPreviewPercent] = useState<number | null>(null);
  const [imageOcrLines, setImageOcrLines] = useState<OcrPreviewLine[] | null>(null);
  const [imageOcrBlocks, setImageOcrBlocks] = useState<OcrPreviewBlock[] | null>(null);
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
      setImageOcrText(detailed.text ?? "");
      setImageOcrPreviewConfidence(detailed.confidence);
      setImageOcrPreviewPercent(detailed.confidencePercent);
      setImageOcrLines(
        detailed.lines.map((l) => ({
          text: l.text,
          confidence: l.confidence,
          confidencePercent: Math.round(l.confidence * 100),
        }))
      );
      setImageOcrBlocks(
        detailed.blocks.map((b) => ({
          text: b.text.length > 400 ? `${b.text.slice(0, 400)}…` : b.text,
          confidence: b.confidence,
          confidencePercent: Math.round(b.confidence * 100),
          lineCount: b.lines.length,
          lines: b.lines.map((l) => ({
            text: l.text.length > 200 ? `${l.text.slice(0, 200)}…` : l.text,
            confidence: l.confidence,
            confidencePercent: Math.round(l.confidence * 100),
          })),
        }))
      );
      const pct = formatOcrPercent(detailed.confidence, detailed.confidencePercent);
      const tierLabel = ocrConfidenceTier(detailed.confidence);
      toast.success("已於瀏覽器擷取圖片文字", {
        description: `辨識信心 ${pct}（${tierLabel}）。請確認下方文字後再送交檢測；伺服器不會再執行 OCR。`,
      });
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
        if (!imageOcrText.trim()) {
          setError("請先按「擷取文字（瀏覽器 OCR）」取得文字，確認或編輯後再送交檢測。");
          toast.error("缺少辨識文字");
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
          支援文字、圖片（OCR）與 PDF（依頁分析）。多帳號共用審查額度：文字／圖片各 1 點；PDF 依頁數扣點。
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
          <CardDescription>登入後使用工作區之共用審查額度；圖片請於瀏覽器擷取文字並編輯後再檢測。</CardDescription>
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
                  setImageOcrPreviewConfidence(null);
                  setImageOcrPreviewPercent(null);
                  setImageOcrLines(null);
                  setImageOcrBlocks(null);
                  setOcrClientError(null);
                  setOcrProgress(null);
                }}
              />
              <p className="text-xs leading-relaxed text-ink-secondary">
                建議清晰海報或截圖；上限 10MB。請先按「擷取文字（瀏覽器 OCR）」於您的裝置上辨識（支援繁中為主），於下方檢查、編輯後再送交檢測；伺服器不再執行 OCR，可避免逾時。
              </p>
              {ocrClientError ? (
                <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
                  <p className="font-medium">瀏覽器辨識失敗</p>
                  <p className="mt-1 text-xs text-red-900/90">{ocrClientError.message}</p>
                  <p className="mt-1 text-[11px] text-red-800/80">代碼：{ocrClientError.code}</p>
                </div>
              ) : null}

              {imagePreviewUrl ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-secondary">原始圖片</p>
                    <div className="relative max-h-64 overflow-hidden rounded-xl border border-surface-border bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs */}
                      <img src={imagePreviewUrl} alt="上傳預覽" className="max-h-64 w-full object-contain object-top" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="secondary" size="sm" disabled={ocrBusy || !imageFile} onClick={() => void runOcrPreview()}>
                        {ocrBusy ? "瀏覽器辨識中…" : "擷取文字（瀏覽器 OCR）"}
                      </Button>
                      {ocrBusy && ocrProgress != null ? (
                        <span className="text-xs tabular-nums text-ink-secondary">{Math.round(ocrProgress * 100)}%</span>
                      ) : null}
                      {imageOcrPreviewConfidence != null ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-surface-border bg-canvas px-2.5 py-1 text-xs text-ink">
                          <span className="text-ink-secondary">OCR 信心</span>
                          <span className="font-semibold tabular-nums text-ink">
                            {formatOcrPercent(imageOcrPreviewConfidence, imageOcrPreviewPercent ?? undefined)}
                          </span>
                          <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[11px] font-medium text-zinc-800">
                            {ocrConfidenceTier(imageOcrPreviewConfidence)}
                          </span>
                          <span className="text-[11px] text-ink-secondary">（以有文字之行平均）</span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-secondary">尚未擷取</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-ink-secondary">送交檢測的文字（可編輯）</p>
                      <Textarea
                        value={imageOcrText}
                        onChange={(e) => setImageOcrText(e.target.value)}
                        placeholder="請先按「擷取文字（瀏覽器 OCR）」…"
                        className="min-h-[160px]"
                      />
                      <p className="text-[11px] leading-relaxed text-ink-secondary">
                        合規分析僅依此欄文字；送檢時一併傳送辨識信心（若有），伺服器不會再執行 OCR。
                      </p>
                    </div>
                    {imageOcrLines && imageOcrLines.length > 0 ? (
                      <details className="rounded-lg border border-surface-border bg-white px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium text-ink">逐行辨識參考（Tesseract）</summary>
                        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-ink-secondary">
                          {imageOcrLines.map((line, i) => (
                            <li key={`${i}-${line.text.slice(0, 12)}`} className="flex flex-wrap gap-x-2 border-b border-zinc-100/90 pb-1 last:border-0">
                              <span className="min-w-0 flex-1 break-words text-ink">{line.text || "（空白行）"}</span>
                              <span className="shrink-0 tabular-nums text-[11px] text-ink-secondary">{line.confidencePercent}%</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {imageOcrBlocks && imageOcrBlocks.length > 0 ? (
                      <details className="rounded-lg border border-surface-border bg-white px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium text-ink">區塊結構參考</summary>
                        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-ink-secondary">
                          {imageOcrBlocks.map((b, i) => (
                            <li key={i} className="rounded-md bg-canvas px-2 py-1.5">
                              <span className="font-medium text-ink">{b.confidencePercent}%</span>
                              <span className="text-ink-secondary"> · {b.lineCount} 行</span>
                              <p className="mt-0.5 line-clamp-3 text-[11px]">{b.text}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
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
                (tab === "image" && (!imageFile || !imageOcrText.trim())) ||
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">圖片與辨識</CardTitle>
                <CardDescription>以下為送交檢測前之上傳預覽；標示後原文依實際送交檢測之文字產生。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="relative max-h-72 overflow-hidden rounded-xl border border-surface-border bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreviewUrl} alt="分析圖片" className="max-h-72 w-full object-contain object-top" />
                </div>
                <div className="space-y-3 text-sm text-ink-secondary">
                  {result.meta.ocrConfidence != null ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ink">
                        OCR 辨識信心（檢測階段）：{" "}
                        <span className="font-semibold tabular-nums text-ink">
                          {formatOcrPercent(result.meta.ocrConfidence)}
                        </span>
                      </p>
                      <span className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-800">
                        {ocrConfidenceTier(result.meta.ocrConfidence)}
                      </span>
                      <span className="text-xs text-ink-secondary">（有文字之行平均）</span>
                    </div>
                  ) : imageOcrPreviewConfidence != null ? (
                    <div className="space-y-1">
                      <p>送交檢測時使用您編輯後的文字，故以下為瀏覽器擷取時之信心參考：</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums text-ink">
                          {formatOcrPercent(imageOcrPreviewConfidence, imageOcrPreviewPercent ?? undefined)}
                        </span>
                        <span className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-800">
                          {ocrConfidenceTier(imageOcrPreviewConfidence)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p>已使用手動輸入或編輯後文字送交檢測（未帶入伺服器 OCR 行級信心）。</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!result.pdfReport ? <NonPdfInsightSummary result={result} /> : null}

          {result.pdfReport ? (
            <PdfReportSection
              report={result.pdfReport}
              aggregateSummary={result.summary}
              allowRegenerate={!result.meta.guest}
              unitsCharged={result.meta.unitsCharged}
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                <div className="space-y-2">
                  <CardTitle>標示後原文</CardTitle>
                  <CardDescription>高亮為系統偵測到的風險片語位置（僅供參考）。</CardDescription>
                </div>
                <MetaBadges
                  result={result}
                  imagePreviewConfidence01={result.meta.inputKind === "image" ? imageOcrPreviewConfidence : null}
                  imagePreviewPercent={result.meta.inputKind === "image" ? imageOcrPreviewPercent : null}
                />
              </CardHeader>
              <CardContent className="rounded-2xl border border-surface-border bg-canvas p-5">
                <HighlightedCopy text={displayTextForHighlight} spans={mergedSpans} />
              </CardContent>
            </Card>
          )}

          {!result.pdfReport ? (
            <Card>
              <CardHeader>
                <CardTitle>總覽摘要</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-ink-secondary">{result.summary}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!result.pdfReport ? (
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
          ) : null}

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
          {kind === "image" ? "圖片（OCR 後文字）" : "文字"} · 發現 {result.findings.length} 項風險片段
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
}: {
  result: AnalysisResult;
  imagePreviewConfidence01?: number | null;
  imagePreviewPercent?: number | null;
}) {
  const showPreviewOcr =
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
      {result.meta.ocrConfidence != null ? (
        <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
          OCR {formatOcrPercent(result.meta.ocrConfidence)}（{ocrConfidenceTier(result.meta.ocrConfidence)}）
        </span>
      ) : showPreviewOcr ? (
        <span className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2 py-1 text-amber-950">
          瀏覽器 OCR {formatOcrPercent(imagePreviewConfidence01, imagePreviewPercent ?? undefined)}（
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
