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

export function AnalyzeView() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestBlocked, setGuestBlocked] = useState(false);

  const mergedSpans = useMemo(() => {
    if (!result) return [];
    return mergeIntervals(result.findings.flatMap((f) => f.spans ?? []));
  }, [result]);

  async function run() {
    setError(null);
    setResult(null);
    setGuestBlocked(false);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as AnalysisResult & { error?: string };
      if (!res.ok) {
        const msg = data.error ?? "分析失敗";
        setError(msg);
        if (res.status === 403 && msg.includes("訪客")) {
          setGuestBlocked(true);
        }
        if (res.status === 429) {
          toast.error("本月配額已用完");
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

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">文案檢測</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          產出包含法規名稱與條號、風險分類、重點原因、法規脈絡與三語氣改寫，協助化粧品與食品廣告在上市前完成第一輪自查。
        </p>
      </div>

      {guestBlocked ? (
        <div className="space-y-3">
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-base text-amber-950">訪客免費檢測已使用</CardTitle>
              <CardDescription className="text-amber-900/80">
                註冊後可解鎖紀錄、配額與重新產生改寫，讓團隊用同一套流程持續迭代文案。
              </CardDescription>
            </CardHeader>
          </Card>
          <GuestConversionCard />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>輸入文案</CardTitle>
          <CardDescription>建議一次貼上完整段落，以便模型掌握語境與前後文。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="貼上你的廣告文案…"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={loading || !text.trim()} onClick={() => void run()}>
              {loading ? "分析中…" : "開始檢測"}
            </Button>
            <span className="text-xs text-ink-secondary">系統會自動選擇可用分析引擎。</span>
          </div>
          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
              {error.includes("配額") ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/billing"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-3 text-xs font-semibold text-white"
                  >
                    前往帳務
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-900"
                  >
                    查看方案
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
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div className="space-y-2">
                <CardTitle>標示後原文</CardTitle>
                <CardDescription>高亮為系統偵測到的風險片語位置（僅供參考）。</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
                <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
                  來源：{result.meta.source === "openai" ? "AI 分析" : "規則引擎"}
                </span>
                {result.meta.guest ? (
                  <span className="rounded-lg border border-brand/20 bg-brand/10 px-2 py-1 text-brand-strong">
                    訪客模式
                  </span>
                ) : (
                  <span className="rounded-lg border border-surface-border bg-white px-2 py-1">
                    剩餘額度：{result.meta.quotaRemaining ?? "—"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="rounded-2xl border border-surface-border bg-surface p-5">
              <HighlightedCopy text={text} spans={mergedSpans} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>總覽摘要</CardTitle>
              <CardDescription className="text-sm leading-relaxed text-ink-secondary">
                {result.summary}
              </CardDescription>
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
                    fullText={text}
                    allowRegenerate={!result.meta.guest}
                  />
                ))}
              </div>
            )}
          </div>

          {result.meta.guest ? <GuestConversionCard /> : null}

          <details className="group rounded-2xl border border-surface-border bg-white/70 p-5 shadow-sm">
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
