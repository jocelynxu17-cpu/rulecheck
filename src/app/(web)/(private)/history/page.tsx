import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { analysisStatusLabel, categorySummary, normalizeAnalysisResult } from "@/lib/analysis-normalize";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const supabase = await createClient();
  const sp = (await searchParams) ?? {};
  const rawWs = sp.workspace;
  const workspaceParam = typeof rawWs === "string" ? rawWs : Array.isArray(rawWs) ? rawWs[0] : undefined;
  const workspaceFilter = workspaceParam && UUID_RE.test(workspaceParam) ? workspaceParam : null;

  let query = supabase.from("analysis_logs").select(
    `
      id,
      created_at,
      input_text,
      result,
      workspace_id,
      workspaces ( name )
    `
  );

  if (workspaceFilter) {
    query = query.eq("workspace_id", workspaceFilter);
  }

  const { data: rows } = await query
    .order("created_at", { ascending: false })
    .limit(workspaceFilter ? 100 : 50);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">紀錄</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">分析紀錄</h1>
            {workspaceFilter ? (
              <Badge tone="blue">工作區篩選</Badge>
            ) : null}
          </div>
          <p className="text-[15px] leading-relaxed text-ink-secondary">
            {workspaceFilter ? (
              <>
                僅顯示指定工作區之檢測紀錄（需為成員且具檢視權限）。
                <Link href="/history" className="ml-2 font-medium text-ink underline-offset-4 hover:underline">
                  清除篩選
                </Link>
              </>
            ) : (
              <>成員可檢視同一工作區的檢測紀錄（依權限）。點進可檢視完整結果。</>
            )}
          </p>
          {workspaceFilter ? (
            <p className="font-mono text-xs text-ink-secondary">
              workspace_id = {workspaceFilter}
            </p>
          ) : null}
        </div>
        <Link
          href="/analyze"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-strong px-5 text-sm font-medium text-white transition hover:bg-brand-strong/90"
        >
          新增檢測
        </Link>
      </div>

      {!rows?.length ? (
        <EmptyState
          title={workspaceFilter ? "此工作區尚無紀錄" : "尚無紀錄"}
          description={
            workspaceFilter
              ? "於選定工作區內尚無檢測紀錄，或你的帳號無法讀取該工作區資料。可改由管理後台工作區營運頁檢視。"
              : "完成第一次檢測後，結果會自動出現在這裡。"
          }
          action={
            workspaceFilter ? (
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/history"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-6 text-sm font-medium text-ink transition hover:bg-zinc-50"
                >
                  清除篩選
                </Link>
                <Link
                  href="/analyze"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-strong px-6 text-sm font-medium text-white transition hover:bg-brand-strong/90"
                >
                  前往檢測
                </Link>
              </div>
            ) : (
              <Link
                href="/analyze"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-strong px-6 text-sm font-medium text-white transition hover:bg-brand-strong/90"
              >
                前往檢測
              </Link>
            )
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
            const ws = r.workspaces as unknown as { name: string } | null;
            const wsName = ws?.name ?? null;

            return (
              <Card key={r.id} className="p-0 transition hover:border-zinc-300/80">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone}>{status}</Badge>
                      <Badge tone="blue">分類：{cats}</Badge>
                      {wsName ? (
                        <span className="rounded-md border border-surface-border bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                          {wsName}
                        </span>
                      ) : null}
                      <span className="text-xs text-ink-secondary">{created}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-relaxed text-ink">
                      {r.input_text.slice(0, 160)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <Link
                      href={`/history/${r.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-surface-border bg-white px-4 text-sm font-medium text-ink transition hover:bg-zinc-50"
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
