import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchInternalWorkspacesList } from "@/lib/admin/fetch-internal-workspaces-list";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";
import {
  INTERNAL_LIST_PAGE_DEFAULT,
  INTERNAL_LIST_PAGE_MAX,
  clampPage,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";
import { flattenInternalSearchParams, hrefWithPage } from "@/lib/admin/internal-pagination-url";
import { InternalOpsListGuideCard } from "@/components/admin/InternalOpsListGuideCard";

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const flat = flattenInternalSearchParams(sp);
  const qRaw = flat.q;
  const q = qRaw?.trim() ? qRaw : undefined;
  const page = clampPage(parsePositiveInt(flat.page, 1));
  const pageSize = clampPageSize(
    parsePositiveInt(flat.page_size, INTERNAL_LIST_PAGE_DEFAULT),
    INTERNAL_LIST_PAGE_DEFAULT,
    INTERNAL_LIST_PAGE_MAX
  );

  const { workspaces, error, yymm, pagination } = await fetchInternalWorkspacesList(q ?? null, {
    page,
    pageSize,
  });

  const prevHref =
    pagination.page > 1
      ? hrefWithPage("/internal/workspaces", flat, { page: String(pagination.page - 1) })
      : null;
  const nextHref = pagination.hasNextPage
    ? hrefWithPage("/internal/workspaces", flat, { page: String(pagination.page + 1) })
    : null;

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

      <InternalOpsListGuideCard
        summary="此頁為工作區營運列表：團隊／額度／帳務細節請以工作區明細為主。"
        bullets={[
          "預設分頁載入；「最近活動／提示」為本頁列之批次抽樣，非全系統即時真相。",
          "需要完整帳務事件流請至「帳務」；全系統內部操作軌跡請至「稽核」。",
          `可查 URL 參數 page_size（1–${INTERNAL_LIST_PAGE_MAX}）調整頁長。`,
        ]}
      />

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">搜尋</CardTitle>
          <CardDescription>依工作區名稱或 UUID 篩選；結果以分頁載入。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center" action="/internal/workspaces" method="get">
            <Input name="q" defaultValue={q ?? ""} placeholder="工作區名稱或 UUID…" className="sm:flex-1" aria-label="搜尋工作區" />
            <input type="hidden" name="page_size" value={String(pageSize)} />
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
            <>
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
                      const remain = w.monthly_quota_units > used ? w.monthly_quota_units - used : 0;
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
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-secondary">
                <span className="text-xs">
                  第 {pagination.page} 頁 · 每頁 {pagination.pageSize} 筆
                  {pagination.hasNextPage ? " · 尚有下一頁" : ""}
                </span>
                <div className="flex gap-2">
                  {prevHref ? (
                    <Link
                      href={prevHref}
                      className="inline-flex h-9 items-center rounded-lg border border-surface-border bg-white px-3 text-sm font-medium text-ink hover:bg-canvas"
                    >
                      上一頁
                    </Link>
                  ) : (
                    <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-transparent px-3 text-sm text-ink-secondary/50">
                      上一頁
                    </span>
                  )}
                  {nextHref ? (
                    <Link
                      href={nextHref}
                      className="inline-flex h-9 items-center rounded-lg border border-surface-border bg-white px-3 text-sm font-medium text-ink hover:bg-canvas"
                    >
                      下一頁
                    </Link>
                  ) : (
                    <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-transparent px-3 text-sm text-ink-secondary/50">
                      下一頁
                    </span>
                  )}
                </div>
              </div>
            </>
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
