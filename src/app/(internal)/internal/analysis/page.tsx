import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ANALYSIS_OPS_SCAN_CAP,
  ANALYSIS_TABLE_OUTPUT_CAP,
  fetchInternalAnalysisCenter,
  type ExtendedAdminAnalysisLogRow,
} from "@/lib/admin/fetch-internal-analysis-center";
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

function RecentAnalysisTable({ rows }: { rows: ExtendedAdminAnalysisLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-secondary">尚無符合條件之紀錄。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
            <th className="px-3 py-2.5">時間</th>
            <th className="px-3 py-2.5">工作區</th>
            <th className="px-3 py-2.5">使用者</th>
            <th className="px-3 py-2.5">類型</th>
            <th className="px-3 py-2.5">Pipeline</th>
            <th className="px-3 py-2.5">營運提示</th>
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
                <td className="max-w-[200px] px-3 py-2.5">
                  <span className="block truncate text-xs text-ink-secondary">{r.user_email ?? r.user_id}</span>
                  <Link
                    href={`/internal/users/${r.user_id}`}
                    className="mt-0.5 inline-block text-[11px] font-medium text-ink underline-offset-4 hover:underline"
                  >
                    使用者頁
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">{inputTypeLabel(r.inputKind ?? r.input_type)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  <span className={isFb ? "text-amber-900" : "text-ink"}>{pipelineLabel(r.source)}</span>
                  {isFb ? <span className="ml-1 text-[10px] text-ink-secondary">fallback</span> : null}
                  {r.is_guest ? <span className="ml-1 text-[10px] text-ink-secondary">guest</span> : null}
                </td>
                <td className="max-w-[280px] px-3 py-2.5 text-[11px] leading-snug text-ink-secondary">
                  {r.ops_hints_line ?? "—"}
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

function buildFilterQuery(base: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v != null && v !== "") p.set(k, v);
  }
  return p.toString();
}

export default async function InternalAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};

  let payRows: Awaited<ReturnType<typeof loadPaymentEvents>>["rows"] = [];
  let payError: string | null = null;
  let center = null as Awaited<ReturnType<typeof fetchInternalAnalysisCenter>> | null;
  let centerErr: string | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    try {
      center = await fetchInternalAnalysisCenter(admin, sp);
    } catch (e) {
      centerErr = e instanceof Error ? e.message : String(e);
    }
    const pay = await loadPaymentEvents(400);
    payRows = pay.rows;
    payError = pay.error;
  }

  const flagged = payRows.filter((r) => isLikelyPaymentFailureEventType(r.event_type));

  const rangeVal = typeof sp.range === "string" ? sp.range : Array.isArray(sp.range) ? sp.range[0] : "";
  const typeVal = typeof sp.type === "string" ? sp.type : Array.isArray(sp.type) ? sp.type[0] : "";
  const workspaceVal = typeof sp.workspace === "string" ? sp.workspace : Array.isArray(sp.workspace) ? sp.workspace[0] : "";
  const userVal = typeof sp.user === "string" ? sp.user : Array.isArray(sp.user) ? sp.user[0] : "";
  const pipelineVal = typeof sp.pipeline === "string" ? sp.pipeline : Array.isArray(sp.pipeline) ? sp.pipeline[0] : "";
  const signalVal = typeof sp.signal === "string" ? sp.signal : Array.isArray(sp.signal) ? sp.signal[0] : "";

  const clearHref = "/internal/analysis";

  return (
    <div className="space-y-10 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">分析營運中心</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-secondary">
          以 <strong className="font-medium text-ink">analysis_logs</strong>{" "}
          為核心：區分輸入類型、管線（OpenAI／規則 fallback）、品質提示與受影響工作區。數值健康度係依時間區間與抽樣掃描（見各卡說明），搭配{" "}
          <Link href="/internal/payment-events" className="font-medium text-ink underline-offset-4 hover:underline">
            帳務事件
          </Link>{" "}
          交叉判讀供應商／付款異常。
        </p>
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">篩選條件</CardTitle>
          <CardDescription>
            以 GET 參數保存狀態可分享連結。時間區間影響摘要與列表；「營運提示」來自結果 JSON（與工作區全景頁相同邏輯）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3" method="get" action="/internal/analysis">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-range">
                時間區間
              </label>
              <select
                id="ia-range"
                name="range"
                defaultValue={rangeVal || "30d"}
                className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
              >
                <option value="7d">近 7 日</option>
                <option value="30d">近 30 日</option>
                <option value="month">本月份（台北）</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-type">
                輸入類型
              </label>
              <select
                id="ia-type"
                name="type"
                defaultValue={typeVal}
                className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
              >
                <option value="">全部</option>
                <option value="text">文字</option>
                <option value="image">圖片</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-pipeline">
                Pipeline
              </label>
              <select
                id="ia-pipeline"
                name="pipeline"
                defaultValue={pipelineVal}
                className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
              >
                <option value="">全部</option>
                <option value="openai">OpenAI</option>
                <option value="mock">規則 fallback</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-signal">
                訊號
              </label>
              <select
                id="ia-signal"
                name="signal"
                defaultValue={signalVal}
                className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
              >
                <option value="all">全部</option>
                <option value="fallback">僅 fallback（mock）</option>
                <option value="abnormal">僅含營運提示（品質／PDF／OCR）</option>
                <option value="risk">fallback 或提示（聯集）</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-workspace">
                工作區 UUID
              </label>
              <Input id="ia-workspace" name="workspace" defaultValue={workspaceVal} placeholder="選填" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="ia-user">
                使用者 UUID 或 Email 關鍵字
              </label>
              <Input id="ia-user" name="user" defaultValue={userVal} placeholder="選填" className="text-sm" />
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" className="rounded-xl">
                套用篩選
              </Button>
              <Link
                href={clearHref}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-surface-border bg-white px-4 text-sm font-medium text-ink shadow-sm transition hover:bg-canvas"
              >
                清除
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {centerErr ? (
        <p className="text-sm text-amber-900">{centerErr}</p>
      ) : center ? (
        <>
          {center.filters.userIds && center.filters.userIds.length > 1 ? (
            <p className="text-xs text-ink-secondary">使用者篩選：已比對多筆帳號（OR）。</p>
          ) : null}
          {center.userFilterNote ? <p className="text-xs text-amber-900">{center.userFilterNote}</p> : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">
              健康度摘要 · {center.filters.rangeLabelZh}（全區間總筆數 {center.countsExact.total}）
            </h2>
            <p className="text-xs text-ink-secondary">
              下列「抽樣列」為區間內最近 {center.scan.rowsScanned} 筆（上限 {ANALYSIS_OPS_SCAN_CAP}
              {center.scan.scanCapped ? "，已達上限，比例為抽樣推估" : ""}）；精確總量以上方「全區間總筆數」為準。
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">正常 AI（OpenAI）</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-ink">{center.health.normalAiHits}</p>
                <p className="mt-1 text-xs text-ink-secondary">於抽樣列中 meta.source=openai</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">Fallback／mock</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-amber-950">{center.health.fallbackMockHits}</p>
                <p className="mt-1 text-xs text-ink-secondary">於抽樣列中後備管線</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">異常／提示信號</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-red-900/90">{center.health.abnormalSignalHits}</p>
                <p className="mt-1 text-xs text-ink-secondary">至少一則 OCR／PDF／圖片軌等提示</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-emerald-50/40 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">營運判讀</p>
                <p className="mt-1 text-xs leading-relaxed text-ink">{center.health.interpretationZh}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ["文字", "text", center.byType.text],
                ["圖片", "image", center.byType.image],
                ["PDF", "pdf", center.byType.pdf],
              ] as const
            ).map(([label, key, tb]) => (
              <Card key={key} className="border-surface-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>抽樣列中 {tb.volume} 筆 · 區間 exact 約 {center.countsExact[key as "text" | "image" | "pdf"]} 筆</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-ink-secondary">
                  <p>
                    OpenAI <span className="tabular-nums text-ink">{tb.openai}</span> · mock{" "}
                    <span className="tabular-nums text-ink">{tb.mock}</span>
                  </p>
                  <p>含提示 <span className="tabular-nums text-ink">{tb.withHints}</span> 筆</p>
                  <p className="text-xs leading-relaxed">
                    主要提示：<span className="text-ink">{tb.topHintLine ?? "—"}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {center.countsExact.unknown > 0 ? (
            <p className="text-xs text-ink-secondary">未標型別（input_type 空值）精確計 {center.countsExact.unknown} 筆，未單獨成卡。</p>
          ) : null}

          <Card className="border-surface-border">
            <CardHeader>
              <CardTitle className="text-base">近期議題分類（抽樣列累計）</CardTitle>
              <CardDescription>
                由同一批抽樣結果 JSON 解析；「provider 錯誤」無單一欄位時，以帳務區失敗事件數代替參考（{center.providerPaymentFailuresInRange} 筆）。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
              <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">OCR 信心偏低</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{center.issueBuckets.ocrLowOrCleanup}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">PDF 無文字層</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{center.issueBuckets.pdfNoTextLayer}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">圖片文字軌偏短</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{center.issueBuckets.imageLowOcrTrack}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">後備管線提示列</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{center.issueBuckets.mockPipelineRows}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">帳務失敗／高風險（同期）</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{center.providerPaymentFailuresInRange}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-surface-border">
            <CardHeader>
              <CardTitle className="text-base">受影響工作區（提示／fallback 熱點）</CardTitle>
              <CardDescription>依抽樣列加權分數（mock 與提示）；分數僅供相對排序。</CardDescription>
            </CardHeader>
            <CardContent>
              {center.impactedWorkspaces.length === 0 ? (
                <p className="text-sm text-ink-secondary">抽樣中尚無帶提示或 fallback 之工作區列。</p>
              ) : (
                <ul className="divide-y divide-surface-border rounded-xl border border-surface-border">
                  {center.impactedWorkspaces.map((w) => (
                    <li key={w.workspace_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <Link
                          href={`/internal/workspaces/${w.workspace_id}`}
                          className="font-medium text-ink underline-offset-4 hover:underline"
                        >
                          {w.workspace_name ?? w.workspace_id.slice(0, 10) + "…"}
                        </Link>
                        <span className="ml-2 tabular-nums text-xs text-ink-secondary">分數 {w.signal_score}</span>
                      </div>
                      <span className="text-xs text-ink-secondary">
                        最近信號 {w.last_signal_at ? formatDateTime(w.last_signal_at) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-ink-secondary">未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入分析資料。</p>
      )}

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">帳務層級可疑事件（供應商／失敗類型）</CardTitle>
          <CardDescription>自最近 {payRows.length} 筆 payment_events 篩出 {flagged.length} 筆</CardDescription>
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

      {center ? (
        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">分析紀錄（篩選後）</CardTitle>
            <CardDescription>
              最多顯示 {ANALYSIS_TABLE_OUTPUT_CAP} 筆（後端先抓取至多 600 筆再套用 Pipeline／訊號篩選）。
              {center.tableTruncationNote ? ` ${center.tableTruncationNote}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentAnalysisTable rows={center.tableRows} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
