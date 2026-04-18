"use client";

import { useMemo, useState } from "react";
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

export function AnalyzeView() {
  const wsCtx = useOptionalWorkspace();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
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

  const mergedSpans = useMemo(() => {
    if (!result) return [];
    return mergeIntervals(result.findings.flatMap((f) => f.spans ?? []));
  }, [result]);

  const displayTextForHighlight = useMemo(() => {
    if (!result) return text;
    if (result.pdfReport && result.pdfReport.pages[0]) return result.pdfReport.pages[0].text;
    return text;
  }, [result, text]);

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

      const data = (await res.json()) as AnalysisResult & { error?: string };
      if (!res.ok) {
        const msg = data.error ?? "分析失敗";
        setError(msg);
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
          支援文字、圖片（OCR）與 PDF（依頁分析）。多帳號共用額度：文字／圖片各 1 點；PDF 依頁數扣點。
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
              <Link href="/team" className="text-xs font-medium text-ink underline-offset-4 hover:underline">
                成員與額度
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">本月共用審查額度</p>
                <p className="mt-1.5 text-xl font-medium tabular-nums tracking-tight text-ink">{activeWs.monthlyQuotaUnits}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">已使用額度</p>
                <p className="mt-1.5 text-xl font-medium tabular-nums tracking-tight text-ink">{used}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-white px-4 py-3.5 ring-1 ring-black/[0.04]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">剩餘額度</p>
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
                註冊後可解鎖共用審查額度、圖片與 PDF 檢測與完整紀錄協作。
              </CardDescription>
            </CardHeader>
          </Card>
          <GuestConversionCard />
        </div>
      ) : null}

      <Card className="p-0">
        <CardHeader className="border-b border-surface-border px-5 py-5 sm:px-6">
          <CardTitle>輸入內容</CardTitle>
          <CardDescription>選擇輸入方式；登入後須使用多帳號共用額度。</CardDescription>
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
            <div className="space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm text-ink-secondary file:mr-4 file:rounded-lg file:border file:border-surface-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-ink-secondary">建議清晰海報或截圖；上限 10MB。將先 OCR 再檢測。</p>
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
              <p className="text-xs text-ink-secondary">依頁數扣點（每頁 1 點），單檔最多 50 頁、20MB。</p>
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
                    href="/team"
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
          {result.pdfReport ? (
            <PdfReportSection
              report={result.pdfReport}
              aggregateSummary={result.summary}
              allowRegenerate={!result.meta.guest}
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                <div className="space-y-2">
                  <CardTitle>標示後原文</CardTitle>
                  <CardDescription>高亮為系統偵測到的風險片語位置（僅供參考）。</CardDescription>
                </div>
                <MetaBadges result={result} />
              </CardHeader>
              <CardContent className="rounded-2xl border border-surface-border bg-surface p-5">
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

function MetaBadges({ result }: { result: AnalysisResult }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
      <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
        來源：{result.meta.source === "openai" ? "AI 分析" : "規則引擎"}
      </span>
      {result.meta.inputKind ? (
        <Badge tone="blue">{result.meta.inputKind === "pdf" ? "PDF" : result.meta.inputKind === "image" ? "圖片" : "文字"}</Badge>
      ) : null}
      {result.meta.unitsCharged != null ? (
        <span className="rounded-lg border border-surface-border bg-white px-2 py-1">扣點：{result.meta.unitsCharged}</span>
      ) : null}
      {result.meta.guest ? (
        <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700">訪客模式</span>
      ) : (
        <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
          剩餘額度：{result.meta.quotaRemaining ?? "—"}
        </span>
      )}
    </div>
  );
}
