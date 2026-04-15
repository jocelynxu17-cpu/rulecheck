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
import { analysisStatusLabel, categorySummary } from "@/lib/analysis-normalize";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row } = await supabase
    .from("analysis_logs")
    .select("id, created_at, input_text, result")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!row) notFound();

  const result = normalizeAnalysisResult(row.result as unknown as AnalysisResult, row.input_text);
  const allSpans = mergeIntervals(result.findings.flatMap((f) => f.spans ?? []));
  const created = new Date(row.created_at).toLocaleString("zh-TW");
  const status = analysisStatusLabel(result.findings);
  const cats = categorySummary(result.findings);
  const statusTone: "neutral" | "emerald" = status === "未偵測到提示" ? "neutral" : "emerald";

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/history" className="text-sm font-semibold text-brand-strong hover:underline">
            ← 返回紀錄
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{status}</Badge>
            <Badge tone="blue">分類：{cats}</Badge>
            <span className="text-xs text-ink-secondary">{created}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">分析結果</h1>
          <p className="text-sm text-ink-secondary">以下為儲存當下的完整輸出，你可重新產生改寫並複製到剪貼簿。</p>
        </div>
      </div>

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
  );
}
