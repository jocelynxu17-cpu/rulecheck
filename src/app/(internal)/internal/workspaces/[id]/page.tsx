import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadWorkspaceAdminDetail,
  WORKSPACE_ADMIN_USAGE_EVENTS_CAP,
} from "@/lib/admin/load-workspace-admin-detail";
import {
  billingProviderLabelZh,
  deriveBillingUiState,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import type { AdminWorkspaceRange } from "@/lib/admin/workspace-admin-range";
import { parseWorkspaceAdminRange, workspaceRangeLabelZh } from "@/lib/admin/workspace-admin-range";
import type { AdminWorkspaceUsageByInputType } from "@/lib/admin/load-workspace-admin-detail";
import { AdminWorkspaceSingleOpsCard } from "@/components/admin/AdminWorkspaceSingleOpsCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInternalOpsAuditLogsFiltered } from "@/lib/admin/internal-ops-audit";
import { InternalAuditLogRow } from "@/components/admin/InternalAuditLogRow";

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

function billingUiStateLabelZh(state: ReturnType<typeof deriveBillingUiState>): string {
  const map: Record<ReturnType<typeof deriveBillingUiState>, string> = {
    free: "免費／未升級方案",
    active: "有效訂閱",
    cancel_scheduled: "已排程期末取消",
    payment_issue: "付款／訂閱異常（需留意）",
  };
  return map[state] ?? state;
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

function inputTypeLabelZh(t: string | null | undefined): string {
  const x = (t ?? "").toLowerCase();
  if (x === "text") return "文字";
  if (x === "image") return "圖片";
  if (x === "pdf") return "PDF";
  return t ?? "—";
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

  const adminClient = createAdminClient();
  const auditQuery = await fetchInternalOpsAuditLogsFiltered(adminClient, { targetId: id }, 28);

  const {
    workspace,
    members,
    operationalSignals,
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
  const remainingThisMonth = Math.max(0, workspace.monthly_quota_units - usedThisMonth);
  const adminDebug = process.env.ADMIN_DEBUG === "1";
  const rangeLabel = workspaceRangeLabelZh(range);
  const sinceLabel = formatSinceBoundaryZh(sinceIso);
  const totalUsageEvents =
    usageByInputType.text.events +
    usageByInputType.image.events +
    usageByInputType.pdf.events +
    usageByInputType.other.events;

  const billingUi = deriveBillingUiState(workspace);
  const billingUiLabel = billingUiStateLabelZh(billingUi);

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-3">
        <Link href="/internal/workspaces" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          ← 返回工作區列表
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">工作區 · 營運核心</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">{workspace.name}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-secondary">
          <strong className="font-medium text-ink">工作區</strong>
          即客戶／團隊在系統中的主要單位：成員、共用審查額度、方案與帳務（SSOT）、以及分析與扣點皆以此聚合。下列卡片依「基本資料 → 帳務與額度 → 成員 →（時間區間）用量與分析 → 異常摘要 → 帳務事件 → 稽核 → 營運動作」排列。
        </p>
        <p className="font-mono text-xs text-ink-secondary">{workspace.id}</p>
      </div>

      {/* A · 基本資料 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">A · 工作區基本資料</CardTitle>
          <CardDescription>辨識此客戶單位與建立資訊。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-ink-secondary">名稱</p>
            <p className="mt-0.5 text-lg font-medium text-ink">{workspace.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">擁有者（created_by）</p>
            <p className="mt-0.5 break-all font-mono text-xs text-ink">{workspace.created_by ?? "—"}</p>
            {workspace.created_by ? (
              <p className="mt-1">
                <Link
                  href={`/internal/users/${workspace.created_by}`}
                  className="text-xs font-medium text-ink underline-offset-4 hover:underline"
                >
                  開啟擁有者營運頁 →
                </Link>
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">建立時間</p>
            <p className="mt-0.5 text-ink">{formatDateTimeTaipei(workspace.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">成員數</p>
            <p className="mt-0.5 tabular-nums text-ink">{members.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">營運狀態摘要</p>
            <p className="mt-0.5 text-ink">{billingUiLabel}</p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              訂閱：{subscriptionStatusLabelZh(workspace.subscription_status)} · 方案：{workspace.plan ?? "—"}
            </p>
          </div>
          <div className="sm:col-span-2 space-y-2 border-t border-surface-border/80 pt-4">
            <p className="text-xs font-medium text-ink-secondary">延伸排查</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <Link href={`/members?workspace=${encodeURIComponent(id)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                前台成員與邀請
              </Link>
              <Link href={`/history?workspace=${encodeURIComponent(id)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                分析紀錄（已篩選）
              </Link>
              <Link href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                帳務事件（已篩選）
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* B · 方案／帳務／額度 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">B · 方案、帳務與共用額度</CardTitle>
          <CardDescription>
            <strong className="font-medium text-ink">工作區為帳務與額度唯一真相來源（SSOT）</strong>
            ，與前台计费、扣點與方案顯示一致；使用者層級欄位若存在僅供補充／遷移參考。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-secondary">方案</p>
            <p className="mt-0.5 text-ink">{workspace.plan ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">訂閱狀態</p>
            <p className="mt-0.5 text-ink">{subscriptionStatusLabelZh(workspace.subscription_status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">帳務來源</p>
            <p className="mt-0.5 text-ink">{billingProviderLabelZh(workspace.billing_provider) ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">月度共用審查額度上限</p>
            <p className="mt-0.5 tabular-nums text-ink">{workspace.monthly_quota_units}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">本月已用（{yymm}）</p>
            <p className="mt-0.5 tabular-nums text-ink">{usedThisMonth}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">本月剩餘額度（推算）</p>
            <p className="mt-0.5 tabular-nums text-ink">{remainingThisMonth}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">目前週期結束</p>
            <p className="mt-0.5 text-ink">{formatDateTaipei(workspace.current_period_end)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">週期末取消</p>
            <p className="mt-0.5 text-ink">{workspace.cancel_at_period_end ? "是" : "否"}</p>
          </div>
        </CardContent>
      </Card>

      {/* C · 成員 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">C · 成員</CardTitle>
          <CardDescription>此工作區內所有帳號與角色；可連結至內部使用者明細。</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-ink-secondary">尚無成員</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">角色</th>
                    <th className="px-4 py-3">加入時間</th>
                    <th className="px-4 py-3">內部使用者</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} className="border-b border-surface-border/80 last:border-0">
                      <td className="max-w-[240px] truncate px-4 py-3 font-medium text-ink">{m.email ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-secondary">{m.role}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTimeTaipei(m.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/internal/users/${m.user_id}`}
                          className="text-xs font-medium text-ink underline-offset-4 hover:underline"
                        >
                          營運頁
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

      {/* 時間區間（影響 D / E / F 之一部） */}
      <Card className="border-surface-border bg-canvas/30">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">資料區間（用量／分析／區間內帳務）</CardTitle>
            <CardDescription>
              目前：<span className="font-medium text-ink">{rangeLabel}</span>
              <span className="mx-1.5">·</span>
              統計起點（含）：{sinceLabel}
            </CardDescription>
          </div>
          <TimeRangeNav workspaceId={id} current={range} />
        </CardHeader>
      </Card>

      {/* D · 用量與分析 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">D · 區間內用量與分析活動</CardTitle>
          <CardDescription>扣點事件、分析紀錄與風險摘要均依上方區間篩選。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
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
            <h3 className="mb-3 text-sm font-semibold text-ink">成員用量排行（區間內）</h3>
            {memberUsageRanking.length === 0 ? (
              <SectionEmptyInRange
                title="尚無可排行之用量或分析"
                hint={`自 ${sinceLabel} 起（${rangeLabel}），尚無成員累計點數或分析次數。`}
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
            <h3 className="mb-3 text-sm font-semibold text-ink">風險分析摘要（區間內）</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              以下為區間內各筆分析之<strong className="font-medium text-ink">發現項目</strong>加總。
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

            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">近期含中高風險之分析</h4>
            {riskyAnalysesRecent.length === 0 ? (
              <SectionEmptyInRange
                title="此區間內無中高風險檢測摘要列"
                hint="在已掃描的分析中，沒有含「高」或「中」嚴重度之發現項目。"
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
                          <Link href={`/history/${a.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
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

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">近期分析紀錄（詳列）</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              「偵測結果」指該次分析是否帶有 findings；「管線／提示」由結果 JSON 推導（後備管線、OCR、PDF 等），非另外造數。
            </p>
            {analyses.length === 0 ? (
              <SectionEmptyInRange
                title="區間內尚無分析紀錄"
                hint={`${rangeLabel} 內尚無 analysis_logs。`}
                workspaceId={id}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">類型</th>
                      <th className="px-4 py-3">偵測結果</th>
                      <th className="px-4 py-3">發現數</th>
                      <th className="px-4 py-3">管線／提示</th>
                      <th className="px-4 py-3">點數</th>
                      <th className="px-4 py-3">詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((a) => (
                      <tr key={a.id} className="border-b border-surface-border/80 last:border-0 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                          {formatDateTimeTaipei(a.created_at)}
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{inputTypeLabelZh(a.input_type)}</td>
                        <td className="px-4 py-3 text-xs text-ink-secondary">
                          {a.findings_count > 0 ? "有偵測到提示" : "未偵測到提示"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-secondary">{a.findings_count}</td>
                        <td className="max-w-[280px] px-4 py-3 text-[11px] leading-snug text-ink-secondary">
                          {a.ops_hints_line ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-secondary">{a.units_charged ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Link href={`/history/${a.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
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

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">用量事件（列表）</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              {rangeLabel}內最新 40 筆 · 起點 {sinceLabel}
            </p>
            {usageEvents.length === 0 ? (
              <SectionEmptyInRange
                title="區間內尚無用量事件（列表）"
                hint={`${rangeLabel} · 起點 ${sinceLabel}。`}
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
                        <td className="px-4 py-3 text-ink-secondary">{inputTypeLabelZh(u.input_type)}</td>
                        <td className="px-4 py-3 tabular-nums text-ink-secondary">{u.units_charged}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-ink-secondary">{u.user_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* E · 營運異常／後備摘要 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">E · 區間內管線／營運提示摘要</CardTitle>
          <CardDescription>
            以下由區間內最多 {operationalSignals.rows_scanned} 筆分析之結果 JSON 掃描而得（與「風險摘要」同一樣本上限）；係「至少出現該提示」之筆數，非全站錯誤率。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
            <p className="text-xs font-medium text-ink-secondary">規則／後備管線</p>
            <p className="mt-1 tabular-nums text-xl font-semibold text-ink">{operationalSignals.rows_with_mock_pipeline}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
            <p className="text-xs font-medium text-ink-secondary">OCR 信心偏低提示</p>
            <p className="mt-1 tabular-nums text-xl font-semibold text-ink">{operationalSignals.rows_with_low_ocr_hint}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
            <p className="text-xs font-medium text-ink-secondary">PDF 無文字／需 OCR</p>
            <p className="mt-1 tabular-nums text-xl font-semibold text-ink">{operationalSignals.rows_with_pdf_text_gap_hint}</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-canvas/40 px-4 py-3">
            <p className="text-xs font-medium text-ink-secondary">圖片文字軌偏短</p>
            <p className="mt-1 tabular-nums text-xl font-semibold text-ink">{operationalSignals.rows_with_image_ocr_short_hint}</p>
          </div>
        </CardContent>
        <CardContent className="border-t border-surface-border/80 pt-4">
          <p className="text-xs leading-relaxed text-ink-secondary">
            <strong className="font-medium text-ink">第二階段可加</strong>
            ：獨立錯誤碼表、PDF 頁級 OCR 成功率、provider 逾時統計—需長期結構化 log，目前不重複存一份。
          </p>
        </CardContent>
      </Card>

      {/* F · 帳務事件 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">F · 帳務與付款事件</CardTitle>
          <CardDescription>
            區間內異常／生命週期事件協助對照上方方案狀態；總覽表為不限區間之最近關聯列（仍取自後端掃描窗口）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">區間內 · 失敗／需留意（金流）</h3>
            {anomalyPaymentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
                <p className="font-medium text-ink">此區間內無失敗／需留意之金流事件</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed">
                  仍建議至{" "}
                  <Link href={`/internal/payment-events?workspace=${encodeURIComponent(id)}`} className="font-medium text-ink underline-offset-4 hover:underline">
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
            <h3 className="mb-2 text-sm font-semibold text-ink">區間內 · 帳務生命週期（訂閱／發票／Checkout）</h3>
            {billingLifecyclePaymentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
                <p className="font-medium text-ink">此區間內無對應類型事件</p>
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

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">近期總覽（最近 40 筆關聯）</h3>
            <p className="mb-3 text-xs text-ink-secondary">不限區間；資料來自全域最近 400 筆付款事件經篩選。</p>
            {paymentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-canvas/20 px-4 py-8 text-center text-sm text-ink-secondary">
                <p className="font-medium text-ink">尚無與此工作區關聯之帳務事件</p>
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
          </div>
        </CardContent>
      </Card>

      {/* G · 稽核 */}
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">G · 近期內部稽核（與此工作區）</CardTitle>
          <CardDescription>
            含目標為此 workspace id 或 JSON 內嵌之營運動作；完整篩選請至{" "}
            <Link href={`/internal/audit?target_id=${encodeURIComponent(id)}`} className="font-medium text-ink underline-offset-4 hover:underline">
              稽核頁
            </Link>
            。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditQuery.error ? (
            <p className="text-sm text-amber-900">無法載入稽核：{auditQuery.error}</p>
          ) : auditQuery.rows.length === 0 ? (
            <p className="text-sm text-ink-secondary">尚無紀錄。</p>
          ) : (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white">
              {auditQuery.rows.map((row) => (
                <InternalAuditLogRow key={row.id} row={row} compact />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* H · 營運動作 */}
      <AdminWorkspaceSingleOpsCard
        key={`${workspace.id}-${workspace.monthly_quota_units}-${workspace.plan ?? ""}-${workspace.subscription_status ?? ""}`}
        workspaceId={workspace.id}
        initialMonthlyQuotaUnits={workspace.monthly_quota_units}
        initialPlan={workspace.plan}
        initialSubscriptionStatus={workspace.subscription_status}
      />

      <Card className="border-surface-border bg-canvas/40">
        <CardHeader>
          <CardTitle className="text-base">對帳備忘</CardTitle>
          <CardDescription>交叉驗證時請固定比對同一 workspace id。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-secondary">
          <ul className="list-inside list-disc space-y-1">
            <li>本頁「方案與額度」應與成員於前台所見同一工作區列一致。</li>
            <li>區間統計與列表應可互相對照；必要時改用「近 7 日」縮小範圍。</li>
            <li>payment_events 若未寫 workspace_id，仍可經由成員 user_id 出現在篩選結果。</li>
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
