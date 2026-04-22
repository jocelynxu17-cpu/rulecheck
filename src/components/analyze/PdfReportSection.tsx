"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisFinding, AnalysisResult } from "@/types/analysis";
import { FindingPanel } from "@/components/analyze/FindingPanel";

function countSeverity(findings: AnalysisFinding[]) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const f of findings) {
    if (f.severity === "high") high += 1;
    else if (f.severity === "medium") medium += 1;
    else low += 1;
  }
  return { high, medium, low };
}

function riskScore(page: { hasRisk: boolean; findings: AnalysisFinding[] }): number {
  if (!page.hasRisk) return -1;
  const { high, medium, low } = countSeverity(page.findings);
  return high * 10_000 + medium * 100 + low + page.findings.length;
}

export function PdfReportSection({
  report,
  aggregateSummary,
  allowRegenerate,
  unitsCharged,
}: {
  report: NonNullable<AnalysisResult["pdfReport"]>;
  aggregateSummary: string;
  allowRegenerate: boolean;
  unitsCharged?: number | null;
}) {
  const sortedPages = useMemo(() => {
    return [...report.pages].sort((a, b) => {
      const ra = riskScore(a);
      const rb = riskScore(b);
      if (rb !== ra) return rb - ra;
      return a.pageNumber - b.pageNumber;
    });
  }, [report.pages]);

  const stats = useMemo(() => {
    let pagesWithHigh = 0;
    let pagesWithRisk = 0;
    let totalFindings = 0;
    let totalHigh = 0;
    for (const p of report.pages) {
      const { high } = countSeverity(p.findings);
      totalFindings += p.findings.length;
      totalHigh += high;
      if (p.hasRisk) pagesWithRisk += 1;
      if (high > 0) pagesWithHigh += 1;
    }
    return { pagesWithHigh, pagesWithRisk, totalFindings, totalHigh };
  }, [report.pages]);

  const totalPages = report.pageCount;

  const riskyPages = useMemo(() => sortedPages.filter((p) => p.hasRisk), [sortedPages]);
  const neutralPages = useMemo(() => sortedPages.filter((p) => !p.hasRisk), [sortedPages]);

  return (
    <div className="space-y-6">
      <Card className="border-surface-border" id="pdf-summary">
        <CardHeader>
          <CardTitle>PDF 分析摘要</CardTitle>
          <CardDescription>
            多帳號共用審查額度依頁數扣點；以下為本文件頁面與風險彙總。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">總頁數</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{totalPages}</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">風險頁數</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{stats.pagesWithRisk}</p>
            </div>
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-900/75">高風險頁數</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-amber-950">{stats.pagesWithHigh}</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-canvas px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">發現項目總數</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{stats.totalFindings}</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-white px-4 py-3 ring-1 ring-black/[0.04] sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">本次扣點</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-ink">
                {unitsCharged != null ? unitsCharged : "—"}
              </p>
              <p className="mt-1 text-[11px] text-ink-secondary">點＝共用審查額度</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-surface-border bg-canvas/80 px-3 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-secondary">
              <span className="font-medium text-ink">頁面導覽</span>
              <span className="text-ink-secondary/70">｜</span>
              <a className="font-medium underline-offset-4 hover:text-ink hover:underline" href="#pdf-summary">
                回摘要
              </a>
            </div>
            {riskyPages.length > 0 ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-amber-900/80">
                  優先（含風險）
                </span>
                {riskyPages.map((p) => {
                  const hi = countSeverity(p.findings).high;
                  return (
                    <a
                      key={p.pageNumber}
                      href={`#pdf-page-${p.pageNumber}`}
                      className={
                        hi > 0
                          ? "rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-900 underline-offset-4 hover:underline"
                          : "rounded-md bg-amber-50/90 px-2 py-0.5 font-medium text-amber-950 underline-offset-4 hover:underline"
                      }
                    >
                      第{p.pageNumber}頁
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-ink-secondary">未偵測到含風險頁面；仍可依下方完整頁面清單逐頁檢視。</p>
            )}
            <details className="group rounded-md border border-surface-border/80 bg-white/70 px-2 py-2">
              <summary className="cursor-pointer list-none text-[11px] font-medium text-ink outline-none [&::-webkit-details-marker]:hidden">
                全部 {totalPages} 頁
                <span className="ml-2 text-ink-secondary group-open:hidden">展開</span>
                <span className="ml-2 hidden text-ink-secondary group-open:inline">收合</span>
              </summary>
              <div className="mt-2 flex max-h-40 flex-wrap gap-x-2 gap-y-1 overflow-y-auto text-[11px] text-ink-secondary">
                {sortedPages.map((p) => {
                  const hi = countSeverity(p.findings).high;
                  return (
                    <a
                      key={p.pageNumber}
                      href={`#pdf-page-${p.pageNumber}`}
                      className={
                        hi > 0
                          ? "text-red-800 underline-offset-4 hover:underline"
                          : p.hasRisk
                            ? "text-amber-900 underline-offset-4 hover:underline"
                            : "underline-offset-4 hover:text-ink hover:underline"
                      }
                    >
                      {p.pageNumber}
                    </a>
                  );
                })}
              </div>
              {neutralPages.length > 0 ? (
                <p className="mt-2 text-[10px] leading-relaxed text-ink-secondary">
                  無底色頁碼為目前未標示風險之頁（仍請以法務意見為準）。
                </p>
              ) : null}
            </details>
          </div>

          <div className="grid gap-3 sm:grid-cols-1">
            <div
              className={
                stats.pagesWithHigh > 0
                  ? "rounded-lg border border-red-200/80 bg-red-50/30 px-4 py-3 ring-1 ring-red-100/40"
                  : "rounded-lg border border-surface-border bg-white px-4 py-3"
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">含風險頁碼</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-ink">
                {report.riskyPageNumbers.length ? report.riskyPageNumbers.join("、") : "無"}
              </p>
              {stats.pagesWithHigh > 0 ? (
                <p className="mt-2 text-[11px] text-red-900/80">其中含高風險片段之頁碼請優先於下方逐頁處理。</p>
              ) : null}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-ink-secondary">{aggregateSummary}</p>
          <p className="text-xs text-ink-secondary">
            下方各頁依風險程度排序：高風險頁優先，便於優先處理。
          </p>
        </CardContent>
      </Card>

      {sortedPages.map((page) => {
        const { high, medium, low } = countSeverity(page.findings);
        return (
          <Card
            key={page.pageNumber}
            id={`pdf-page-${page.pageNumber}`}
            className={
              high > 0
                ? "scroll-mt-24 border border-red-200/90 border-l-4 border-l-red-600 bg-red-50/25 shadow-md ring-2 ring-red-100/50"
                : page.hasRisk
                  ? "scroll-mt-24 border border-amber-200/85 border-l-4 border-l-amber-500/90 bg-amber-50/20"
                  : "scroll-mt-24"
            }
          >
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">第 {page.pageNumber} 頁</CardTitle>
                <span className="text-xs tabular-nums text-ink-secondary">
                  發現 {page.findings.length} 筆
                  {page.findings.length ? (
                    <>
                      {" "}
                      （高 {high} / 中 {medium} / 低 {low}）
                    </>
                  ) : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {high > 0 ? (
                  <Badge tone="red">高風險</Badge>
                ) : page.hasRisk ? (
                  <Badge tone="amber">含風險</Badge>
                ) : (
                  <Badge tone="neutral">未偵測</Badge>
                )}
                <a
                  className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  href="#pdf-summary"
                >
                  回摘要
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-surface-border bg-canvas p-4 text-sm text-ink">
                <p className="line-clamp-6 whitespace-pre-wrap">{page.text}</p>
              </div>
              <p className="text-xs text-ink-secondary">{page.summary}</p>
              {page.findings.length ? (
                <div className="space-y-4">
                  {page.findings.map((f, idx) => (
                    <FindingPanel
                      key={`${page.pageNumber}-${idx}`}
                      finding={f}
                      fullText={page.text}
                      allowRegenerate={allowRegenerate}
                    />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
