import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchInternalWorkspacesList } from "@/lib/admin/fetch-internal-workspaces-list";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";

function formatDateTimeTaipeiShort(iso: string): string {
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

function formatPeriodEndTaipeiShort(iso: string | null | undefined): string {
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

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const qRaw = sp.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
  const { workspaces, error, yymm } = await fetchInternalWorkspacesList(q);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">工作區</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          <strong className="font-medium text-ink">工作區即營運核心單位</strong>
          ：對應客戶／團隊、成員、共用額度、方案與帳務，以及分析活動。所有欄位以單一工作區列與關聯資料為準；明細頁可切換時間區間深入檢視。
        </p>
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">搜尋</CardTitle>
          <CardDescription>依工作區名稱或 UUID 篩選（最多 350 筆）。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center" action="/internal/workspaces" method="get">
            <Input name="q" defaultValue={q ?? ""} placeholder="工作區名稱或 UUID…" className="sm:flex-1" aria-label="搜尋工作區" />
            <div className="flex gap-2">
              <Button type="submit" className="rounded-xl">
                搜尋
              </Button>
              {q ? (
                <Link
                  href="/internal/workspaces"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-surface-border bg-white px-4 text-sm font-medium text-ink shadow-sm ring-offset-white transition hover:bg-canvas"
                >
                  清除
                </Link>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">工作區列表</CardTitle>
          <CardDescription>
            點選工作區名稱進入全景。「最近活動」為批次掃描扣點與分析之較新時間（非全量回溯）；「提示」來自該區最新分析結果 JSON（見明細）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-amber-900">{error}</p> : null}
          {!error && workspaces.length === 0 ? (
            <p className="text-sm text-ink-secondary">沒有符合的工作區。</p>
          ) : null}
          {!error && workspaces.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">工作區</th>
                    <th className="px-4 py-3">擁有者</th>
                    <th className="px-4 py-3">成員</th>
                    <th className="px-4 py-3">方案</th>
                    <th className="px-4 py-3">訂閱</th>
                    <th className="px-4 py-3">帳務來源</th>
                    <th className="px-4 py-3">週期結束</th>
                    <th className="px-4 py-3">期末取消</th>
                    <th className="px-4 py-3">共用額度</th>
                    <th className="px-4 py-3">本月已用</th>
                    <th className="px-4 py-3">最近活動</th>
                    <th className="px-4 py-3 max-w-[200px]">提示</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((w) => {
                    const used = w.usage_month === yymm ? w.units_used_month : 0;
                    const remain =
                      w.monthly_quota_units > used ? w.monthly_quota_units - used : 0;
                    return (
                      <tr key={w.id} className="border-b border-surface-border/80 transition hover:bg-canvas/40">
                        <td className="max-w-[220px] px-4 py-3 align-top">
                          <Link
                            href={`/internal/workspaces/${w.id}`}
                            className="font-medium text-ink underline-offset-4 hover:underline"
                          >
                            {w.name}
                          </Link>
                          <div className="mt-0.5 font-mono text-[11px] text-ink-secondary/90">{w.id}</div>
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 align-top text-xs text-ink-secondary">
                          {w.owner_email ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-ink-secondary">{w.member_count}</td>
                        <td className="px-4 py-3 align-top text-ink-secondary">{w.plan ?? "—"}</td>
                        <td className="px-4 py-3 align-top text-xs text-ink-secondary">
                          {subscriptionStatusLabelZh(w.subscription_status)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-ink-secondary">
                          {billingProviderLabelZh(w.billing_provider) ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-ink-secondary">
                          {formatPeriodEndTaipeiShort(w.current_period_end)}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-secondary">{w.cancel_at_period_end ? "是" : "否"}</td>
                        <td className="px-4 py-3 align-top tabular-nums text-ink-secondary">{w.monthly_quota_units}</td>
                        <td className="whitespace-nowrap px-4 py-3 align-top text-xs">
                          <span className="text-ink">{used}</span>
                          <span className="text-ink-secondary">／{w.monthly_quota_units}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-secondary">剩 {remain}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-ink-secondary">
                          {w.last_activity_at ? formatDateTimeTaipeiShort(w.last_activity_at) : "—"}
                        </td>
                        <td className="max-w-[220px] px-4 py-3 align-top text-[11px] leading-snug text-ink-secondary">
                          {w.ops_hint_summary ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-ink-secondary">
            <strong className="font-medium text-ink">延後／非即時項目（第二階段可評估）</strong>
            ：全站即時錯誤率、provider 原始 log、跨工作區排名、發票號碼對帳等需額外資料管線或索引；目前列表不重跑 N 次全文掃描。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
