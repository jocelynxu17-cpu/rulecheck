import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildEmptyAdminAnalysisOverview,
  fetchAdminAnalysisOverview,
  fetchAdminRecentAnalysisLogs,
  type AdminAnalysisLogRow,
} from "@/lib/admin/fetch-admin-analysis-overview";
import { loadPaymentEvents } from "@/lib/admin/load-payment-events";
import { isLikelyPaymentFailureEventType } from "@/lib/admin/payment-event-signals";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function inputTypeLabel(t: string | null | undefined): string {
  if (t === "text") return "文字";
  if (t === "image") return "圖片";
  if (t === "pdf") return "PDF";
  return t ?? "—";
}

function pipelineLabel(source: string | null): string {
  if (source === "openai") return "OpenAI";
  if (source === "mock") return "規則 fallback";
  return source ?? "—";
}

function RecentAnalysisTable({ rows }: { rows: AdminAnalysisLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-secondary">尚無紀錄。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
            <th className="px-3 py-2.5">時間</th>
            <th className="px-3 py-2.5">工作區</th>
            <th className="px-3 py-2.5">使用者</th>
            <th className="px-3 py-2.5">類型</th>
            <th className="px-3 py-2.5">Pipeline</th>
            <th className="px-3 py-2.5">Findings</th>
            <th className="px-3 py-2.5">扣點</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isFb = r.source === "mock";
            return (
              <tr key={r.id} className="border-b border-surface-border/80 align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-secondary">{formatDateTime(r.created_at)}</td>
                <td className="max-w-[180px] px-3 py-2.5">
                  {r.workspace_id ? (
                    <Link
                      href={`/internal/workspaces/${r.workspace_id}`}
                      className="line-clamp-2 text-xs font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {r.workspace_name ?? r.workspace_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-secondary">—</span>
                  )}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-ink-secondary">{r.user_email ?? r.user_id}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">{inputTypeLabel(r.inputKind ?? r.input_type)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  <span className={isFb ? "text-amber-900" : "text-ink"}>{pipelineLabel(r.source)}</span>
                  {isFb ? <span className="ml-1 text-[10px] text-ink-secondary">fallback</span> : null}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-xs">{r.findingsCount}</td>
                <td className="px-3 py-2.5 text-xs text-ink-secondary">
                  {r.units_charged != null ? r.units_charged : "—"}
                  {r.pdf_page_count != null && r.pdf_page_count > 0 ? (
                    <span className="ml-1 text-[10px]">· PDF {r.pdf_page_count}p</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function InternalAnalysisPage() {
  let overview = buildEmptyAdminAnalysisOverview();
  let recentRows: AdminAnalysisLogRow[] = [];
  let recentError: string | null = null;
  let payRows: Awaited<ReturnType<typeof loadPaymentEvents>>["rows"] = [];
  let payError: string | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    overview = await fetchAdminAnalysisOverview(admin);
    const logOut = await fetchAdminRecentAnalysisLogs(admin, 80);
    recentRows = logOut.rows;
    recentError = logOut.error;
    const pay = await loadPaymentEvents(400);
    payRows = pay.rows;
    payError = pay.error;
  }

  const flagged = payRows.filter((r) => isLikelyPaymentFailureEventType(r.event_type));
  const pipelineTotal = overview.openaiCountSample + overview.mockCountSample;
  const fallbackRate =
    pipelineTotal > 0 ? `${Math.round((overview.mockCountSample / pipelineTotal) * 100)}%` : "—";

  return (
    <div className="space-y-10 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">分析營運</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          分析次數、類型分布、pipeline（OpenAI／規則 fallback）與紀錄表。帳務層級異常事件併列於此，便於與{" "}
          <Link href="/internal/payment-events" className="font-medium text-ink underline-offset-4 hover:underline">
            帳務
          </Link>{" "}
          交叉查看。
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-ink">近 7 日摘要</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">分析次數</p>
            <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{overview.weekCount}</p>
            <p className="mt-1 text-xs text-ink-secondary">今日 {overview.todayCount}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">類型分布</p>
            <p className="mt-1 text-sm text-ink">
              文字 {overview.byInputWeek.text} · 圖片 {overview.byInputWeek.image} · PDF {overview.byInputWeek.pdf}
            </p>
            {overview.byInputWeek.unknown ? (
              <p className="mt-1 text-xs text-ink-secondary">未標型別 {overview.byInputWeek.unknown}</p>
            ) : null}
          </div>
          <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">Pipeline（樣本）</p>
            <p className="mt-1 text-sm text-ink">
              OpenAI {overview.openaiCountSample} · mock {overview.mockCountSample}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">fallback 約 {fallbackRate}（{overview.pipelineSampleSize} 筆）</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">活躍工作區（估）</p>
            <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{overview.activeWorkspacesWeekApprox}</p>
            <p className="mt-1 text-xs text-ink-secondary">近 7 日、最多 4000 筆去重</p>
          </div>
        </div>
        {overview.error ? <p className="mt-2 text-xs text-amber-900">{overview.error}</p> : null}
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">帳務層級可疑事件（供應商／失敗類型）</CardTitle>
          <CardDescription>自最近 {payRows.length} 筆 payment_events 篩出 {flagged.length} 筆（與舊「供應商紀錄」相同規則）</CardDescription>
        </CardHeader>
        <CardContent>
          {payError ? (
            <p className="text-sm text-amber-900">{payError}</p>
          ) : flagged.length === 0 ? (
            <p className="text-sm text-ink-secondary">目前無符合條件之事件。</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">時間</th>
                    <th className="px-4 py-3">供應商／狀態</th>
                    <th className="px-4 py-3">事件類型</th>
                    <th className="px-4 py-3">使用者</th>
                    <th className="px-4 py-3">摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((r) => (
                    <tr key={r.id} className="border-b border-surface-border/80 last:border-0 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">{formatDateTime(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <PaymentEventBadges provider={r.provider} eventType={r.event_type} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentEventTypeBadge eventType={r.event_type} />
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-secondary">
                        {r.user_email ?? r.user_id ?? "—"}
                      </td>
                      <td className="max-w-md px-4 py-3 text-[11px] leading-snug text-amber-950/90">
                        {summarizePaymentPayload(r.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">最近分析紀錄</CardTitle>
          <CardDescription>最新 80 筆；pipeline 取自 result.meta.source</CardDescription>
        </CardHeader>
        <CardContent>
          {recentError ? <p className="text-sm text-amber-900">{recentError}</p> : <RecentAnalysisTable rows={recentRows} />}
        </CardContent>
      </Card>
    </div>
  );
}
