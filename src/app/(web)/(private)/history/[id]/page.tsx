import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AnalysisResult } from "@/types/analysis";
import { normalizeAnalysisResult } from "@/lib/analysis-normalize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightedCopy } from "@/components/HighlightedCopy";
import { Badge } from "@/components/ui/badge";
import { mergeIntervals } from "@/lib/text-spans";
import { FindingPanel } from "@/components/analyze/FindingPanel";
import { PdfReportSection } from "@/components/analyze/PdfReportSection";
import { analysisStatusLabel, categorySummary } from "@/lib/analysis-normalize";
import { AnalysisWorkspaceMetaCard } from "@/components/analysis/AnalysisWorkspaceMetaCard";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("analysis_logs")
    .select(
      `
      id,
      created_at,
      input_text,
      result,
      workspace_id,
      workspaces ( name )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const result = normalizeAnalysisResult(row.result as unknown as AnalysisResult, row.input_text);
  const allSpans = mergeIntervals(result.findings.flatMap((f) => f.spans ?? []));
  const created = new Date(row.created_at).toLocaleString("zh-TW");
  const status = analysisStatusLabel(result.findings);
  const cats = categorySummary(result.findings);
  const statusTone: "neutral" | "emerald" = status === "未偵測到提示" ? "neutral" : "emerald";
  const workspaceJoin = row.workspaces as { name: string } | { name: string }[] | null;
  const workspaceNameFromRow = Array.isArray(workspaceJoin) ? workspaceJoin[0]?.name : workspaceJoin?.name;
  const workspaceContextLine =
    result.meta.workspaceName?.trim() ||
    (typeof workspaceNameFromRow === "string" && workspaceNameFromRow.trim() ? workspaceNameFromRow.trim() : null);

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/history" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            ← 返回紀錄
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{status}</Badge>
            <Badge tone="blue">分類：{cats}</Badge>
            <span className="text-xs text-ink-secondary">{created}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">分析結果</h1>
          {workspaceContextLine ? (
            <p className="text-sm text-ink-secondary">
              工作區：{workspaceContextLine}
              {row.workspace_id ? (
                <span className="ml-2 font-mono text-xs text-ink-secondary/80">({row.workspace_id as string})</span>
              ) : null}
            </p>
          ) : null}
          <p className="text-sm text-ink-secondary">以下為儲存當下的完整輸出，你可重新產生改寫並複製到剪貼簿。</p>
        </div>
      </div>

      <AnalysisWorkspaceMetaCard meta={result.meta} />

      {result.pdfReport ? (
        <PdfReportSection report={result.pdfReport} aggregateSummary={result.summary} allowRegenerate />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>原文</CardTitle>
              <CardDescription>儲存當下的輸入內容（長文可能已截斷）。</CardDescription>
            </CardHeader>
            <CardContent className="rounded-2xl border border-surface-border bg-surface p-5">
              <HighlightedCopy text={row.input_text} spans={allSpans} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>總覽摘要</CardTitle>
              <CardDescription className="text-sm leading-relaxed text-ink-secondary">{result.summary}</CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-5">
            <h2 className="text-xl font-semibold tracking-tight text-ink">發現項目</h2>
            <div className="space-y-6">
              {result.findings.map((f, idx) => (
                <FindingPanel key={`${f.riskyPhrase}-${idx}`} finding={f} fullText={row.input_text} allowRegenerate />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
