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
}: {
  report: NonNullable<AnalysisResult["pdfReport"]>;
  aggregateSummary: string;
  allowRegenerate: boolean;
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

  return (
    <div className="space-y-6">
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle>PDF 風險摘要</CardTitle>
          <CardDescription>
            共 {report.pageCount} 頁；含風險內容 {stats.pagesWithRisk} 頁
            {stats.pagesWithHigh ? `（其中 ${stats.pagesWithHigh} 頁含高風險項目）` : ""}。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-surface-border bg-surface/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">風險頁碼</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {report.riskyPageNumbers.length ? report.riskyPageNumbers.join("、") : "無"}
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">發現項目總數</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.totalFindings}</p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/75">高風險筆數</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">{stats.totalHigh}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">{aggregateSummary}</p>
          <p className="text-xs text-ink-secondary">
            下方依風險程度排序：高風險頁優先顯示，便於優先處理。
          </p>
        </CardContent>
      </Card>

      {sortedPages.map((page) => {
        const { high, medium, low } = countSeverity(page.findings);
        return (
          <Card
            key={page.pageNumber}
            className={
              high > 0
                ? "border-red-200/70 ring-1 ring-red-100/40"
                : page.hasRisk
                  ? "border-amber-200/80"
                  : ""
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
              {high > 0 ? (
                <Badge tone="red">高風險</Badge>
              ) : page.hasRisk ? (
                <Badge tone="amber">含風險</Badge>
              ) : (
                <Badge tone="neutral">未偵測</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface p-4 text-sm text-ink">
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
