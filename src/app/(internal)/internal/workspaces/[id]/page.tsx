import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadWorkspaceAdminDetail,
  WORKSPACE_ADMIN_USAGE_EVENTS_CAP,
} from "@/lib/admin/load-workspace-admin-detail";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import type { AdminWorkspaceRange } from "@/lib/admin/workspace-admin-range";
import { parseWorkspaceAdminRange, workspaceRangeLabelZh } from "@/lib/admin/workspace-admin-range";
import type { AdminWorkspaceUsageByInputType } from "@/lib/admin/load-workspace-admin-detail";
import { AdminWorkspaceSingleOpsCard } from "@/components/admin/AdminWorkspaceSingleOpsCard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTimeTaipei(iso: string): string {
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

function formatDateTaipei(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatSinceBoundaryZh(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function TimeRangeNav({ workspaceId, current }: { workspaceId: string; current: AdminWorkspaceRange }) {
  const items: { id: AdminWorkspaceRange; label: string }[] = [
    { id: "7d", label: "近 7 日" },
    { id: "30d", label: "近 30 日" },
    { id: "month", label: "本月份" },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="用量與分析資料區間">
      {items.map((it) => {
        const active = it.id === current;
        const href =
          it.id === "30d"
            ? `/internal/workspaces/${workspaceId}`
            : `/internal/workspaces/${workspaceId}?range=${encodeURIComponent(it.id)}`;
        return (
          <Link
            key={it.id}
            href={href}
            scroll={false}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              active
                ? "border-surface-border bg-white text-ink shadow-sm ring-1 ring-surface-border"
                : "border-transparent text-ink-secondary hover:border-surface-border hover:bg-white/80 hover:text-ink"
            }`}
            aria-current={active ? "true" : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

function SectionEmptyInRange({
  title,
  hint,
  workspaceId,
}: {
  title: string;
  hint: string;
  workspaceId: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-canvas/25 px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-ink-secondary">{hint}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href={`/internal/workspaces/${workspaceId}?range=7d`}
          className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-zinc-50"
        >
          近 7 日
        </Link>
        <Link
          href={`/internal/workspaces/${workspaceId}`}
          className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-zinc-50"
        >
          近 30 日
        </Link>
        <Link
          href={`/internal/workspaces/${workspaceId}?range=month`}
          className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-zinc-50"
        >
          本月份
        </Link>
      </div>
    </div>
  );
}

function UsageTypeSummaryGrid({ summary }: { summary: AdminWorkspaceUsageByInputType }) {
  const rows: { key: keyof AdminWorkspaceUsageByInputType; title: string }[] = [
    { key: "text", title: "文字" },
    { key: "image", title: "圖片" },
    { key: "pdf", title: "PDF" },
    { key: "other", title: "其他" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(({ key, title }) => {
        const b = summary[key];
        return (
          <div
            key={key}
            className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3 text-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{title}</p>
            <p className="mt-2 tabular-nums text-lg font-semibold text-ink">{b.units}</p>
            <p className="text-xs text-ink-secondary">點數合計 · {b.events} 筆事件</p>
          </div>
        );
      })}
    </div>
  );
}

type BillingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminWorkspaceDetailPage({ params, searchParams }: BillingPageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseWorkspaceAdminRange(resolvedSearchParams.range);

  const payload = await loadWorkspaceAdminDetail(id, range);
  if (payload.error === "not_found") {
    notFound();
  }
  if (payload.error || !payload.workspace) {
    return (
      <div className="space-y-6 pb-8">
        <p className="text-sm text-amber-900">{payload.error ?? "無法載入工作區"}</p>
        <Link href="/internal/workspaces" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          ← 返回工作區列表
        </Link>
      </div>
    );
  }

  const {
    workspace,
    members,
    sinceIso,
    usageByInputType,
    memberUsageRanking,
    riskFindingCounts,
    riskyAnalysesRecent,
    analysesRiskTruncated,
    usageEvents,
    analyses,
    paymentEvents,
    anomalyPaymentEvents,
    billingLifecyclePaymentEvents,
    usageEventsTruncated,
    analysisCountTruncated,
  } = payload;
  const yymm = new Date().toISOString().slice(0, 7);
  const usedThisMonth = workspace.usage_month === yymm ? workspace.units_used_month : 0;
  const adminDebug = process.env.ADMIN_DEBUG === "1";
  const rangeLabel = workspaceRangeLabelZh(range);
  const sinceLabel = formatSinceBoundaryZh(sinceIso);
  const totalUsageEvents =
    usageByInputType.text.events +
    usageByInputType.image.events +
    usageByInputType.pdf.events +
    usageByInputType.other.events;

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-2">
        <Link href="/internal/workspaces" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          ← 返回工作區列表
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">工作區 · 全景</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">{workspace.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          單一客戶用量、分析、帳務與稽核匯總；用於快速判斷「用得好不好、哪裡出問題、要不要手動介入」。
        </p>
        <p className="font-mono text-xs text-ink-secondary">{workspace.id}</p>
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">方案與額度</CardTitle>
          <CardDescription>工作區為帳務與額度 SSOT；與前台儀表板、分析 API 讀取一致。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-secondary">方案</p>
            <p className="mt-0.5 text-ink">{workspace.plan ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">訂閱狀態</p>
            <p className="mt-0.5 text-ink-secondary">{subscriptionStatusLabelZh(workspace.subscription_status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">帳務來源</p>
            <p className="mt-0.5 text-ink-secondary">
              {billingProviderLabelZh(workspace.billing_provider) ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">月度共用審查額度上限</p>
            <p className="mt-0.5 tabular-nums text-ink">{workspace.monthly_quota_units}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">本月已用（{yymm}）</p>
            <p className="mt-0.5 tabular-nums text-ink-secondary">{usedThisMonth}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">目前週期結束</p>
            <p className="mt-0.5 text-ink-secondary">{formatDateTaipei(workspace.current_period_end)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">週期末取消</p>
            <p className="mt-0.5 text-ink-secondary">{workspace.cancel_at_period_end ? "是" : "否"}</p>
          </div>
        </CardContent>
      </Card>

      <AdminWorkspaceSingleOpsCard
        key={`${workspace.id}-${workspace.monthly_quota_units}-${workspace.plan ?? ""}-${workspace.subscription_status ?? ""}`}
        workspaceId={workspace.id}
        initialMonthlyQuotaUnits={workspace.monthly_quota_units}
        initialPlan={workspace.plan}
        initialSubscriptionStatus={workspace.subscription_status}
      />

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">快速連結</CardTitle>
          <CardDescription>於相關畫面延續排查（成員／紀錄頁需帳號具對應權限）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-ink-secondary">
          <p>
            <Link
              href={`/members?workspace=${encodeURIComponent(id)}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              成員與邀請
            </Link>
            — 若目前登入帳號為該工作區成員，將依網址參數自動切換工作區。
          </p>
          <p>
            <Link
              href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              帳務（已篩選）
            </Link>
            — 依 payload 之 workspace_id 或成員 user_id。
          </p>
          <p>
            <Link href="/internal/analysis" className="font-medium text-ink underline-offset-4 hover:underline">
              分析營運
            </Link>
            — 全站分析次數與帳務層級異常摘要。
          </p>
          <p>
            <Link
              href={`/history?workspace=${encodeURIComponent(id)}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              分析紀錄（已篩選）
            </Link>
            — 僅列出該工作區檢測紀錄（RLS 與成員資格適用）。
          </p>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">用量與分析區間</CardTitle>
            <CardDescription>
              目前：<span className="font-medium text-ink">{rangeLabel}</span>
              <span className="mx-1.5 text-ink-secondary">·</span>
              統計起點（含）：{sinceLabel}
            </CardDescription>
          </div>
          <TimeRangeNav workspaceId={id} current={range} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">用量依輸入類型</h3>
            {totalUsageEvents === 0 ? (
              <SectionEmptyInRange
                title="區間內尚無用量事件"
                hint={`自 ${sinceLabel} 起（${rangeLabel}），尚無寫入 usage_events。若預期有扣點，請確認檢測是否成功、或改選較長區間。`}
                workspaceId={id}
              />
            ) : (
              <>
                <UsageTypeSummaryGrid summary={usageByInputType} />
                {usageEventsTruncated ? (
                  <p className="mt-2 text-xs text-amber-900">
                    用量事件列超過上限，摘要僅根據前 {WORKSPACE_ADMIN_USAGE_EVENTS_CAP} 筆計算；列表仍顯示區間內最新 40 筆。
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">成員用量排行</h3>
            {memberUsageRanking.length === 0 ? (
              <SectionEmptyInRange
                title="尚無可排行之用量或分析"
                hint={`自 ${sinceLabel} 起（${rangeLabel}），尚無成員累計點數或分析次數。新工作區或靜默期屬正常；亦可切換區間確認。`}
                workspaceId={id}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">成員</th>
                      <th className="px-4 py-3">點數合計</th>
                      <th className="px-4 py-3">分析次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberUsageRanking.map((r, idx) => (
                      <tr key={r.user_id} className="border-b border-surface-border/80 last:border-0">
                        <td className="px-4 py-3">
                          <span className="tabular-nums text-xs text-ink-secondary">{idx + 1}.</span>{" "}
                          <span className="font-medium text-ink">{r.email ?? "—"}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-ink-secondary">{r.user_id}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-secondary">{r.units_used}</td>
                        <td className="px-4 py-3 tabular-nums text-ink-secondary">{r.analysis_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analysisCountTruncated ? (
              <p className="mt-2 text-xs text-amber-900">「分析次數」僅統計區間內前 5000 筆紀錄。</p>
            ) : null}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">風險分析摘要</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              以下為區間內各筆分析之<strong className="font-medium text-ink">發現項目</strong>加總（非分析筆數）。
              {analysesRiskTruncated ? " 僅掃描最近 800 筆分析之 JSON。" : ""}
            </p>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["高", riskFindingCounts.high, "text-red-800"],
                  ["中", riskFindingCounts.medium, "text-amber-900"],
                  ["低", riskFindingCounts.low, "text-ink-secondary"],
                ] as const
              ).map(([label, n, cls]) => (
                <div key={label} className="rounded-xl border border-surface-border bg-white px-4 py-3">
                  <p className="text-xs font-medium text-ink-secondary">嚴重度 · {label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{n}</p>
                </div>
              ))}
              <div className="rounded-xl border border-surface-border bg-white px-4 py-3">
                <p className="text-xs font-medium text-ink-secondary">至少一則提示之分析</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {riskFindingCounts.analyses_with_any_finding}
                </p>
              </div>
            </div>

            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              近期含中高風險之分析
            </h4>
            {riskyAnalysesRecent.length === 0 ? (
              <SectionEmptyInRange
                title="此區間內無中高風險檢測摘要列"
                hint="代表在已掃描的分析中，沒有含「高」或「中」嚴重度之發現項目；並不代表未做檢測。可改選較長區間或至下方分析列表逐筆開啟。"
                workspaceId={id}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">提示概況</th>
                      <th className="px-4 py-3">詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskyAnalysesRecent.map((a) => (
                      <tr key={a.id} className="border-b border-surface-border/80 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                          {formatDateTimeTaipei(a.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-secondary">
                          <span className="text-red-800">高 {a.high_count}</span>
                          <span className="mx-1.5 text-ink-secondary/50">·</span>
                          <span className="text-amber-900">中 {a.medium_count}</span>
                          <span className="mx-1.5 text-ink-secondary/50">·</span>
                          <span>低 {a.low_count}</span>
                          <span className="mt-1 block text-[11px]">{a.status_label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/history/${a.id}`}
                            className="font-medium text-ink underline-offset-4 hover:underline"
                          >
                            檢視
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">用量事件（列表）</CardTitle>
          <CardDescription>
            {rangeLabel}內最新 40 筆 · 起點 {sinceLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageEvents.length === 0 ? (
            <SectionEmptyInRange
              title="區間內尚無用量事件（列表）"
              hint={`${rangeLabel} · 起點 ${sinceLabel}。若列表應有資料，請確認時區或改選「本月份」。`}
              workspaceId={id}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">時間</th>
                    <th className="px-4 py-3">類型</th>
                    <th className="px-4 py-3">點數</th>
                    <th className="px-4 py-3">使用者</th>
                  </tr>
                </thead>
                <tbody>
                  {usageEvents.map((u) => (
                    <tr key={u.id} className="border-b border-surface-border/80 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTimeTaipei(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{u.input_type}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-secondary">{u.units_charged}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-ink-secondary">{u.user_id}</td>
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
          <CardTitle className="text-base">分析紀錄（列表）</CardTitle>
          <CardDescription>
            {rangeLabel}內最新 40 筆 · 連結至使用者端歷史詳情
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyses.length === 0 ? (
            <SectionEmptyInRange
              title="區間內尚無分析紀錄"
              hint={`${rangeLabel} 內尚無 analysis_logs。可至「分析紀錄（已篩選）」確認使用者端是否同樣為空，或拉長區間。`}
              workspaceId={id}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">時間</th>
                    <th className="px-4 py-3">類型</th>
                    <th className="px-4 py-3">點數</th>
                    <th className="px-4 py-3">詳情</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a.id} className="border-b border-surface-border/80 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTimeTaipei(a.created_at)}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{a.input_type ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-secondary">{a.units_charged ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/history/${a.id}`}
                          className="font-medium text-ink underline-offset-4 hover:underline"
                        >
                          檢視
                        </Link>
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
          <CardTitle className="text-base">異常與注意事件</CardTitle>
          <CardDescription>
            {rangeLabel}內、與本工作區關聯之帳務事件：金流狀態為「失敗／需留意」者；另列訂閱／發票／Checkout 等生命週期事件供對照（資料庫未另存工作區變更稽核時，僅能由此輔助）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">失敗／需留意（金流）</h3>
            {anomalyPaymentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
                <p className="font-medium text-ink">此區間內無失敗／需留意之金流事件</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed">
                  仍建議至{" "}
                  <Link
                    href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    帳務事件（已篩選）
                  </Link>{" "}
                  檢視完整關聯列。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">結果</th>
                      <th className="px-4 py-3">事件類型</th>
                      <th className="px-4 py-3">使用者</th>
                      <th className="px-4 py-3">摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyPaymentEvents.map((r) => (
                      <tr key={r.id} className="border-b border-surface-border/80 last:border-0 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                          {formatDateTimeTaipei(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentEventBadges provider={r.provider} eventType={r.event_type} />
                        </td>
                        <td className="px-4 py-3">
                          <PaymentEventTypeBadge eventType={r.event_type} />
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-secondary">
                          {r.user_email ?? r.user_id ?? "—"}
                        </td>
                        <td className="max-w-md px-4 py-3 text-[11px] leading-snug text-ink-secondary">
                          {summarizePaymentPayload(r.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">帳務狀態相關（生命週期）</h3>
            {billingLifecyclePaymentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
                <p className="font-medium text-ink">此區間內無訂閱／發票／Checkout 類型事件</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed">
                  資料庫未另存工作區列變更稽核；payload 常僅含 stripe 事件 id。可搭配「帳務與額度」SSOT 與{" "}
                  <Link
                    href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    已篩選帳務列表
                  </Link>{" "}
                  對照。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">結果</th>
                      <th className="px-4 py-3">事件類型</th>
                      <th className="px-4 py-3">使用者</th>
                      <th className="px-4 py-3">摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingLifecyclePaymentEvents.map((r) => (
                      <tr key={r.id} className="border-b border-surface-border/80 last:border-0 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                          {formatDateTimeTaipei(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentEventBadges provider={r.provider} eventType={r.event_type} />
                        </td>
                        <td className="px-4 py-3">
                          <PaymentEventTypeBadge eventType={r.event_type} />
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-secondary">
                          {r.user_email ?? r.user_id ?? "—"}
                        </td>
                        <td className="max-w-md px-4 py-3 text-[11px] leading-snug text-ink-secondary">
                          {summarizePaymentPayload(r.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">近期帳務事件（總覽）</CardTitle>
          <CardDescription>
            不限區間：與本工作區關聯之最近 40 筆（來源為最近 400 筆全域事件經篩選）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
              <p className="font-medium text-ink">尚無與此工作區關聯之帳務事件</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed">
                可能尚未寫入 workspace_id，或最近 400 筆全域事件中無成員關聯。請至{" "}
                <Link
                  href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  帳務事件（已篩選）
                </Link>{" "}
                以較大掃描範圍檢視。
              </p>
            </div>
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
                  {paymentEvents.map((r) => (
                    <tr key={r.id} className="border-b border-surface-border/80 last:border-0 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTimeTaipei(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentEventBadges provider={r.provider} eventType={r.event_type} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentEventTypeBadge eventType={r.event_type} />
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-secondary">
                        {r.user_email ?? r.user_id ?? "—"}
                      </td>
                      <td className="max-w-md px-4 py-3 text-[11px] leading-snug text-ink-secondary">
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
          <CardTitle className="text-base">成員</CardTitle>
          <CardDescription>{members.length} 人</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-ink-secondary">尚無成員</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">角色</th>
                    <th className="px-4 py-3">加入時間</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} className="border-b border-surface-border/80 last:border-0">
                      <td className="max-w-[240px] truncate px-4 py-3 font-medium text-ink">{m.email ?? m.user_id}</td>
                      <td className="px-4 py-3 text-ink-secondary">{m.role}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTimeTaipei(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-surface-border bg-canvas/40">
        <CardHeader>
          <CardTitle className="text-base">一致性 QA 備註</CardTitle>
          <CardDescription>內部對帳時請交叉比對同一 workspace id。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-secondary">
          <ul className="list-inside list-disc space-y-1">
            <li>本頁「帳務與額度」應與成員於 /billing、/dashboard 所見相同工作區列一致。</li>
            <li>區間內之用量／分析／風險統計與列表應互相對得上（必要時切換「近 7 日」縮小範圍排查）。</li>
            <li>若 payment_events 未寫入 workspace_id，仍可透過成員 user_id 關聯出現於帳務列表。</li>
          </ul>
        </CardContent>
      </Card>

      {adminDebug ? (
        <details className="rounded-xl border border-dashed border-amber-800/40 bg-amber-50/50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-950">ADMIN_DEBUG：原始工作區列</summary>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-100">
            {JSON.stringify(workspace, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
