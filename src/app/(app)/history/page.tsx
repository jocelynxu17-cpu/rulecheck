import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { analysisStatusLabel, categorySummary, normalizeAnalysisResult } from "@/lib/analysis-normalize";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("analysis_logs")
    .select("id, created_at, input_text, result")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">分析紀錄</h1>
          <p className="mt-2 text-sm text-ink-secondary">快速掌握狀態、分類摘要與建立時間，點進可重新檢視完整結果。</p>
        </div>
        <Link
          href="/analyze"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-5 text-sm font-semibold text-white shadow-soft transition hover:brightness-[1.03]"
        >
          新增檢測
        </Link>
      </div>

      {!rows?.length ? (
        <EmptyState
          title="尚無紀錄"
          description="完成第一次文案檢測後，結果會自動出現在這裡。"
          action={
            <Link
              href="/analyze"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong px-6 text-sm font-semibold text-white shadow-soft"
            >
              前往檢測
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const norm = normalizeAnalysisResult(r.result, r.input_text);
            const cats = categorySummary(norm.findings);
            const status = analysisStatusLabel(norm.findings);
            const created = new Date(r.created_at).toLocaleString("zh-TW");
            const statusTone: "neutral" | "emerald" = status === "未偵測到提示" ? "neutral" : "emerald";

            return (
              <Card key={r.id} className="p-0 transition hover:border-brand/35 hover:shadow-card">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone}>{status}</Badge>
                      <Badge tone="blue">分類：{cats}</Badge>
                      <span className="text-xs text-ink-secondary">{created}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-relaxed text-ink">
                      {r.input_text.slice(0, 160)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <Link
                      href={`/history/${r.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-surface-border bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40"
                    >
                      開啟分析
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
