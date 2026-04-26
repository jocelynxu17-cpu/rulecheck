import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { subscriptionStatusLabelZh } from "@/lib/billing/subscription-state";
import type { AdminHomeSnapshot, AdminPaymentEventRow } from "@/lib/admin/fetch-admin-home";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import { AdminWorkspaceOpsCard } from "@/components/admin/AdminWorkspaceOpsCard";
import { InternalOpsAuditSection } from "@/components/admin/InternalOpsAuditSection";
import { InternalSystemEnvCard } from "@/components/admin/InternalSystemEnvCard";

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

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-white/80 px-4 py-4 shadow-none ring-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-secondary">{label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-secondary">{hint}</p> : null}
    </div>
  );
}

function PaymentEventSnippetList({ rows }: { rows: AdminPaymentEventRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-secondary">目前無符合條件之事件（於最近 80 筆內掃描）。</p>;
  }
  return (
    <ul className="divide-y divide-surface-border/80">
      {rows.map((ev) => (
        <li key={ev.id} className="space-y-2 py-3 first:pt-0">
          <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
          <div className="flex flex-wrap items-center gap-2">
            <PaymentEventTypeBadge eventType={ev.event_type} />
            <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
          </div>
          <p className="text-xs text-ink-secondary">{ev.user_email ?? ev.user_id ?? "—"}</p>
          <p className="text-[11px] leading-snug text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
        </li>
      ))}
    </ul>
  );
}

const quickLinks = [
  { href: "/internal/workspaces", label: "工作區", desc: "客戶單位、額度與帳務" },
  { href: "/internal/analysis", label: "分析營運", desc: "用量、成功率、紀錄與供應商事件" },
  { href: "/internal/payment-events", label: "帳務", desc: "付款與訂閱事件" },
  { href: "/internal/audit", label: "稽核", desc: "內部操作軌跡" },
  { href: "/internal/security", label: "安全", desc: "權限與敏感操作摘要" },
  { href: "/internal/settings", label: "設定", desc: "環境與系統限制摘要" },
  { href: "/internal/debug", label: "除錯工具", desc: "技術用測試與 JSON" },
];

export function AdminHomeDashboard({ snapshot }: { snapshot: AdminHomeSnapshot }) {
  const {
    yymm,
    totals,
    runtime,
    recentWorkspaces,
    recentInvites,
    recentPaymentEvents,
    errorLikePaymentEvents,
    recentBillingNotifyEvents,
    recentProviderFailureEvents,
    recentInternalOpsAudit,
    analysisOverview,
  } = snapshot;

  const ao = analysisOverview;
  const pipelineTotal = ao.openaiCountSample + ao.mockCountSample;
  const openaiRatio =
    pipelineTotal > 0 ? `${Math.round((ao.openaiCountSample / pipelineTotal) * 100)}%` : "—";
  const mockRatio =
    pipelineTotal > 0 ? `${Math.round((ao.mockCountSample / pipelineTotal) * 100)}%` : "—";

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">總覽</h1>
          <Badge tone="amber">Beta</Badge>
        </div>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          今日與近 7 日分析活動、本月審查累計（UTC <span className="font-mono text-ink">{yymm}</span>
          ）、帳務與稽核摘要。細部請至各分頁。
        </p>
      </div>

      {snapshot.errorMessage ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
          {snapshot.errorMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <InternalSystemEnvCard runtime={runtime} />
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink">快速操作</h2>
          <div className="grid gap-3 sm:grid-cols-1">
            {quickLinks.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group rounded-xl border border-surface-border bg-white/70 px-4 py-3 transition hover:border-ink/15 hover:bg-white"
              >
                <p className="text-sm font-medium text-ink group-hover:underline">{q.label}</p>
                <p className="mt-1 text-xs text-ink-secondary">{q.desc}</p>
              </Link>
            ))}
            <Link
              href="/internal/users"
              className="group rounded-xl border border-dashed border-surface-border bg-canvas/30 px-4 py-3 text-sm text-ink-secondary transition hover:border-ink/15 hover:bg-white/80"
            >
              <span className="font-medium text-ink group-hover:underline">用戶</span>
              <span className="mt-1 block text-xs">查帳號、所屬工作區與內部權限</span>
            </Link>
          </div>
        </section>
      </div>

      {snapshot.ok ? (
        <>
          <div>
            <h2 className="mb-3 text-sm font-medium text-ink">分析與活躍度（今日／近 7 日）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="今日分析次數" value={ao.todayCount} hint="analysis_logs" />
              <StatCard label="近 7 日分析次數" value={ao.weekCount} />
              <StatCard
                label="近 7 日 · 文字／圖片／PDF"
                value={`${ao.byInputWeek.text}／${ao.byInputWeek.image}／${ao.byInputWeek.pdf}`}
                hint={ao.byInputWeek.unknown ? `未標型別 ${ao.byInputWeek.unknown}` : undefined}
              />
              <StatCard
                label="分析 pipeline（樣本）"
                value={`OpenAI ${openaiRatio}`}
                hint={`mock ${mockRatio} · 樣本 ${ao.pipelineSampleSize} 筆`}
              />
              <StatCard label="近 7 日活躍工作區（估）" value={ao.activeWorkspacesWeekApprox} hint="最多 4000 筆去重" />
              <StatCard label="近 7 日新註冊用戶" value={ao.newUsersWeek} />
              <StatCard label="付費中工作區（Pro＋有效訂閱）" value={ao.paidWorkspacesCount} />
            </div>
            {ao.error ? (
              <p className="mt-2 text-xs text-amber-900">分析摘要載入：{ao.error}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="註冊使用者（全站）" value={totals.userCount} />
            <StatCard label="總工作區數" value={totals.workspaceCount} hint="含個人預設與團隊" />
            <StatCard label="多帳號共用工作區數" value={totals.sharedWorkspaceCount} hint="成員數大於 1" />
            <StatCard label="本月審查次數" value={totals.analysesThisMonth} hint="analysis_logs 筆數" />
            <StatCard label="本月已用審查點數" value={totals.chargedUnitsThisMonth} hint="各工作區本月已用 units 加總" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">近期供應商失敗／異常</CardTitle>
                  <Link
                    href="/internal/analysis"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    分析營運
                  </Link>
                </div>
                <CardDescription>
                  非 <code className="rounded bg-canvas px-0.5 font-mono text-[11px]">app</code> provider，且事件類型符合失敗／風險規則（最近 80 筆內最多 10 筆）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentEventSnippetList rows={recentProviderFailureEvents} />
              </CardContent>
            </Card>

            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">近期帳務 Notify</CardTitle>
                  <Link
                    href="/internal/payment-events"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    帳務事件
                  </Link>
                </div>
                <CardDescription>notify 類或 payload 含 billing_state（最近 80 筆內最多 10 筆）</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentEventSnippetList rows={recentBillingNotifyEvents} />
              </CardContent>
            </Card>
          </div>

          <InternalOpsAuditSection rows={recentInternalOpsAudit} />

          <Card className="border-surface-border bg-canvas/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">工作區修復動作</CardTitle>
              <CardDescription>
                全站／單一修復會寫入 <code className="rounded bg-canvas px-0.5 font-mono text-[11px]">internal_ops_audit_log</code>
                ；仍建議重大變更於外部變更單留存。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink-secondary">
              <p>
                可搭配{" "}
                <Link href="/internal/debug" className="font-medium text-ink underline-offset-4 hover:underline">
                  偵錯
                </Link>{" "}
                查工作區原始列、或對照{" "}
                <Link href="/internal/payment-events" className="font-medium text-ink underline-offset-4 hover:underline">
                  帳務事件
                </Link>
                。
              </p>
              <p className="text-xs">
                執行入口見下方「工作區營運」；單筆修復亦可於{" "}
                <Link href="/internal/workspaces" className="font-medium text-ink underline-offset-4 hover:underline">
                  工作區詳情
                </Link>
                操作。
              </p>
            </CardContent>
          </Card>

          <AdminWorkspaceOpsCard />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">近期工作區</CardTitle>
                  <Link
                    href="/internal/workspaces"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    全部
                  </Link>
                </div>
                <CardDescription>依建立時間，最新 8 筆</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0">
                {recentWorkspaces.length === 0 ? (
                  <p className="text-sm text-ink-secondary">尚無資料</p>
                ) : (
                  <ul className="divide-y divide-surface-border/80">
                    {recentWorkspaces.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-secondary">{w.id}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-ink-secondary">
                          <span>{w.plan ?? "—"}</span>
                          <span className="mx-1 text-surface-border">·</span>
                          <span>{subscriptionStatusLabelZh(w.subscription_status)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">近期邀請</CardTitle>
                  <Link
                    href="/internal/workspaces"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    工作區
                  </Link>
                </div>
                <CardDescription>依建立時間</CardDescription>
              </CardHeader>
              <CardContent>
                {recentInvites.length === 0 ? (
                  <p className="text-sm text-ink-secondary">尚無邀請</p>
                ) : (
                  <ul className="divide-y divide-surface-border/80">
                    {recentInvites.map((inv) => (
                      <li key={inv.id} className="py-3 first:pt-0">
                        <p className="text-sm font-medium text-ink">{inv.email}</p>
                        <p className="mt-0.5 text-xs text-ink-secondary">
                          {inv.workspace_name ?? "（工作區）"} · {inv.role}
                          {inv.accepted_at ? " · 已接受" : ""}
                          {inv.revoked_at ? " · 已撤銷" : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-secondary">{formatDateTime(inv.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">近期帳務事件</CardTitle>
                  <Link
                    href="/internal/payment-events"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    全部
                  </Link>
                </div>
                <CardDescription>Webhook 等寫入之 payment_events</CardDescription>
              </CardHeader>
              <CardContent>
                {recentPaymentEvents.length === 0 ? (
                  <p className="text-sm text-ink-secondary">尚無紀錄</p>
                ) : (
                  <ul className="divide-y divide-surface-border/80">
                    {recentPaymentEvents.map((ev) => (
                      <li key={ev.id} className="space-y-2 py-3 first:pt-0">
                        <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                        <div className="flex flex-wrap items-center gap-2">
                          <PaymentEventTypeBadge eventType={ev.event_type} />
                          <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                        </div>
                        <p className="text-xs text-ink-secondary">{ev.user_email ?? ev.user_id ?? "—"}</p>
                        <p className="text-[11px] leading-snug text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-surface-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">帳務層級異常／失敗事件</CardTitle>
                  <Link
                    href="/internal/analysis"
                    className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                  >
                    詳情
                  </Link>
                </div>
                <CardDescription>
                  依事件類型關鍵字篩選（failed、error 等），規則與「分析營運」帳務區相同；非完整 API Log
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errorLikePaymentEvents.length === 0 ? (
                  <p className="text-sm text-ink-secondary">目前無符合條件之帳務事件。</p>
                ) : (
                  <ul className="divide-y divide-surface-border/80">
                    {errorLikePaymentEvents.map((ev) => (
                      <li key={ev.id} className="space-y-2 py-3 first:pt-0">
                        <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                        <div className="flex flex-wrap items-center gap-2">
                          <PaymentEventTypeBadge eventType={ev.event_type} />
                          <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                        </div>
                        <p className="text-xs text-ink-secondary">{ev.user_email ?? ev.user_id ?? "—"}</p>
                        <p className="text-[11px] leading-snug text-amber-950/90">{summarizePaymentPayload(ev.payload)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
