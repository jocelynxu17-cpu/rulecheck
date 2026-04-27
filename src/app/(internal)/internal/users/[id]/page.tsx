import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInternalUserDetail } from "@/lib/admin/fetch-internal-user-detail";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import { InternalUserAuthCard } from "@/components/admin/InternalUserAuthCard";
import { InternalUserOpsCard } from "@/components/admin/InternalUserOpsCard";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export default async function InternalUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const detail = await fetchInternalUserDetail(id);

  if (detail.error && !detail.profile && !detail.auth) {
    return (
      <div className="space-y-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">無法載入</CardTitle>
            <CardDescription>{detail.error}</CardDescription>
          </CardHeader>
        </Card>
        <Link href="/internal/users" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          ← 返回用戶列表
        </Link>
      </div>
    );
  }

  if (!detail.profile) {
    notFound();
  }

  const p = detail.profile;
  const auth = detail.auth;
  const bannedUntil = auth?.banned_until ?? null;
  const initialBanned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
  const emailVerified = auth?.email_confirmed_at ? "已驗證" : "未驗證／無紀錄";
  const accountStatus = initialBanned ? "已停用（Auth ban）" : "使用中";
  const internalAccess = canAccessInternalOps(p.email);

  const opsKey = `${p.id}-${p.monthly_analysis_quota}-${p.plan}-${p.subscription_status ?? ""}-${p.current_period_end ?? ""}-${p.cancel_at_period_end}-${p.billing_provider ?? ""}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">使用者明細</h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            <span className="font-mono text-sm text-ink">{p.email ?? "—"}</span>
          </p>
        </div>
        <Link
          href="/internal/users"
          className="shrink-0 text-sm font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
        >
          ← 用戶列表
        </Link>
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-secondary">Email</p>
            <p className="text-sm text-ink">{p.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">使用者 ID</p>
            <p className="break-all font-mono text-xs text-ink">{p.id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">註冊時間（資料列）</p>
            <p className="text-sm text-ink">{formatDateTimeTaipei(p.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">Email 驗證（Auth）</p>
            <p className="text-sm text-ink">{emailVerified}</p>
            {auth?.email_confirmed_at ? (
              <p className="mt-0.5 text-xs text-ink-secondary">{formatDateTimeTaipei(auth.email_confirmed_at)}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">帳號狀態</p>
            <p className="text-sm text-ink">{accountStatus}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-secondary">內部營運權限（環境設定）</p>
            <p className="text-sm text-ink">{internalAccess ? "可進入內部後台" : "否"}</p>
          </div>
        </CardContent>
      </Card>

      <InternalUserAuthCard userId={p.id} initialBanned={initialBanned} />

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">Auth 狀態摘要</CardTitle>
          <CardDescription>僅供營運判斷；不含密碼與敏感權杖。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink">
          {detail.auth_error ? <p className="text-amber-900">Auth 載入：{detail.auth_error}</p> : null}
          {!auth && !detail.auth_error ? <p className="text-ink-secondary">無 Auth 摘要。</p> : null}
          {auth ? (
            <ul className="list-inside list-disc space-y-1 text-ink-secondary">
              <li>最近登入：{auth.last_sign_in_at ? formatDateTimeTaipei(auth.last_sign_in_at) : "—"}</li>
              <li>登入提供者：{auth.providers.length ? auth.providers.join("、") : "—"}</li>
              <li>電話：{auth.phone ?? "—"}</li>
              {bannedUntil ? <li>ban 直到：{formatDateTimeTaipei(bannedUntil)}</li> : null}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">方案與額度（使用者列）</CardTitle>
          <CardDescription>
            下列為 <code className="font-mono text-[11px]">public.users</code>{" "}
            上的個人分析額度與歷史帳務快照。若產品以工作區計費為準，請以「工作區成員」區塊內各工作區欄位與{" "}
            <Link href="/internal/workspaces" className="font-medium text-ink underline-offset-4 hover:underline">
              工作區明細
            </Link>{" "}
            為主；此處可能僅為遷移殘留或補充資訊。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-ink-secondary">plan：</span>
            <span className="text-ink">{p.plan ?? "—"}</span>
          </div>
          <div>
            <span className="text-ink-secondary">subscription_status：</span>
            <span className="text-ink">{subscriptionStatusLabelZh(p.subscription_status)}</span>
          </div>
          <div>
            <span className="text-ink-secondary">monthly_analysis_quota：</span>
            <span className="text-ink">{p.monthly_analysis_quota}</span>
          </div>
          <div>
            <span className="text-ink-secondary">本月已用（個人欄位）：</span>
            <span className="text-ink">{p.usage_month ? p.analyses_used_month : 0}</span>
            <span className="text-ink-secondary">（usage_month {p.usage_month || "—"}）</span>
          </div>
          <div>
            <span className="text-ink-secondary">billing_provider：</span>
            <span className="text-ink">{billingProviderLabelZh(p.billing_provider) ?? "—"}</span>
          </div>
          <div>
            <span className="text-ink-secondary">current_period_end：</span>
            <span className="text-ink">{formatDateTaipei(p.current_period_end)}</span>
          </div>
          <div>
            <span className="text-ink-secondary">cancel_at_period_end：</span>
            <span className="text-ink">{p.cancel_at_period_end ? "是" : "否"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">帳務摘要（使用者列 + 訂閱表）</CardTitle>
          <CardDescription>Stripe／金流識別碼與訂閱列僅供對帳；實際收款事件見下方。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-ink">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-ink-secondary">stripe_customer_id：</span>
              <span className="break-all font-mono text-xs">{p.stripe_customer_id ?? "—"}</span>
            </p>
            <p>
              <span className="text-ink-secondary">stripe_subscription_id：</span>
              <span className="break-all font-mono text-xs">{p.stripe_subscription_id ?? "—"}</span>
            </p>
          </div>
          {detail.subscriptions.length === 0 ? (
            <p className="text-ink-secondary">無 subscriptions 列。</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">週期結束</th>
                    <th className="px-3 py-2">期末取消</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.subscriptions.map((s) => (
                    <tr key={s.id} className="border-b border-surface-border/80 last:border-0">
                      <td className="px-3 py-2">{billingProviderLabelZh(s.provider) ?? s.provider}</td>
                      <td className="px-3 py-2">{subscriptionStatusLabelZh(s.status)}</td>
                      <td className="px-3 py-2">{s.plan}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTaipei(s.current_period_end)}</td>
                      <td className="px-3 py-2">{s.cancel_at_period_end ? "是" : "否"}</td>
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
          <CardTitle className="text-base">工作區成員（帳務以工作區為準）</CardTitle>
          <CardDescription>各列連結至內部工作區明細。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.memberships_error ? (
            <p className="text-sm text-amber-900">成員列表載入：{detail.memberships_error}</p>
          ) : null}
          {detail.memberships.length === 0 ? (
            <p className="text-sm text-ink-secondary">無工作區成員列。</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-3 py-2">工作區</th>
                    <th className="px-3 py-2">角色</th>
                    <th className="px-3 py-2">方案</th>
                    <th className="px-3 py-2">訂閱狀態</th>
                    <th className="px-3 py-2">帳務來源</th>
                    <th className="px-3 py-2">週期結束</th>
                    <th className="px-3 py-2">期末取消</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.memberships.map((m) => (
                    <tr key={m.workspace_id} className="border-b border-surface-border/80 last:border-0">
                      <td className="px-3 py-2">
                        <Link
                          href={`/internal/workspaces/${m.workspace_id}`}
                          className="font-medium text-ink underline-offset-4 hover:underline"
                        >
                          {m.workspace_name}
                        </Link>
                        <div className="font-mono text-[11px] text-ink-secondary">{m.workspace_id}</div>
                      </td>
                      <td className="px-3 py-2">{m.role}</td>
                      <td className="px-3 py-2">{m.plan ?? "—"}</td>
                      <td className="px-3 py-2">{subscriptionStatusLabelZh(m.subscription_status)}</td>
                      <td className="px-3 py-2">{billingProviderLabelZh(m.billing_provider) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTaipei(m.current_period_end)}</td>
                      <td className="px-3 py-2">{m.cancel_at_period_end ? "是" : "否"}</td>
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
          <CardTitle className="text-base">近期付款／帳務事件</CardTitle>
          <CardDescription>依 user_id 關聯之 payment_events（精簡顯示）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.payment_events.length === 0 ? (
            <p className="text-sm text-ink-secondary">無紀錄。</p>
          ) : (
            <ul className="space-y-3">
              {detail.payment_events.map((ev) => (
                <li key={ev.id} className="rounded-xl border border-surface-border bg-canvas/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                    <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} />
                    <PaymentEventTypeBadge eventType={ev.event_type} />
                    <span>{formatDateTimeTaipei(ev.created_at)}</span>
                    {ev.subscription_id ? (
                      <span className="font-mono text-[11px]">sub {ev.subscription_id.slice(0, 8)}…</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InternalUserOpsCard
        key={opsKey}
        userId={p.id}
        initialMonthlyAnalysisQuota={p.monthly_analysis_quota}
        initialPlan={p.plan}
        initialSubscriptionStatus={p.subscription_status}
        initialCurrentPeriodEndIso={p.current_period_end}
        initialCancelAtPeriodEnd={p.cancel_at_period_end}
        initialBillingProvider={p.billing_provider}
      />
    </div>
  );
}
