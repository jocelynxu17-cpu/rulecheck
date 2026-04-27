import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchInternalUsersList } from "@/lib/admin/fetch-internal-users-list";
import { subscriptionStatusLabelZh } from "@/lib/billing/subscription-state";
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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function InternalUsersPage({
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

  const { users, error, yymm, pagination } = await fetchInternalUsersList(q ?? null, {
    page,
    pageSize,
  });

  const prevHref =
    pagination.page > 1
      ? hrefWithPage("/internal/users", flat, { page: String(pagination.page - 1) })
      : null;
  const nextHref = pagination.hasNextPage
    ? hrefWithPage("/internal/users", flat, { page: String(pagination.page + 1) })
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">用戶</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          搜尋帳號並進入明細。訂閱與共用審查額度以{" "}
          <Link href="/internal/workspaces" className="font-medium text-ink underline-offset-4 hover:underline">
            工作區
          </Link>{" "}
          為準時，請以工作區頁面為主、此處為帳號層級補充。
        </p>
      </div>

      <InternalOpsListGuideCard
        summary="此頁為帳號營運列表：單一客戶狀態請以使用者明細為主。"
        bullets={[
          "預設分頁載入；搜尋會套用篩選並從第 1 頁開始較合理（送出搜尋即可）。",
          "最近活動來自已載入使用者之用量事件批次掃描（非全系統稽核）；全系統軌跡請至稽核／帳務頁。",
          `可查 URL 參數 page_size（1–${INTERNAL_LIST_PAGE_MAX}）調整頁長。`,
        ]}
      />

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">搜尋</CardTitle>
          <CardDescription>依 Email 或使用者 UUID 篩選；結果以分頁載入。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center" action="/internal/users" method="get">
            <Input name="q" defaultValue={q ?? ""} placeholder="Email 或 UUID…" className="sm:flex-1" aria-label="搜尋使用者" />
            <input type="hidden" name="page_size" value={String(pageSize)} />
            <div className="flex gap-2">
              <Button type="submit" className="rounded-xl">
                搜尋
              </Button>
              {q ? (
                <Link
                  href="/internal/users"
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
          <CardTitle className="text-base">使用者列表</CardTitle>
          <CardDescription>點擊列或 Email 進入明細頁。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-amber-900">{error}</p> : null}
          {!error && users.length === 0 ? (
            <p className="text-sm text-ink-secondary">沒有符合的使用者。</p>
          ) : null}
          {!error && users.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">註冊</th>
                      <th className="px-4 py-3">最近活動</th>
                      <th className="px-4 py-3">工作區數</th>
                      <th className="px-4 py-3">方案</th>
                      <th className="px-4 py-3">訂閱狀態</th>
                      <th className="px-4 py-3">本月用量</th>
                      <th className="px-4 py-3">內部權限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const used = u.usage_month === yymm ? u.analyses_used_month : 0;
                      return (
                        <tr key={u.id} className="border-b border-surface-border/80 last:border-0">
                          <td className="max-w-[260px] px-4 py-3">
                            <Link
                              href={`/internal/users/${u.id}`}
                              className="font-medium text-ink underline-offset-4 hover:underline"
                            >
                              {u.email ?? "—"}
                            </Link>
                            <div className="mt-0.5 font-mono text-[11px] text-ink-secondary/90">{u.id}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">{formatDateTimeTaipeiShort(u.created_at)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                            {u.last_activity_at ? formatDateTimeTaipeiShort(u.last_activity_at) : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink-secondary">{u.workspace_count}</td>
                          <td className="px-4 py-3 text-ink-secondary">{u.plan ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-secondary">{subscriptionStatusLabelZh(u.subscription_status)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                            {used} / {u.monthly_analysis_quota}
                            <span className="ml-1 text-ink-secondary/70">（個人欄位）</span>
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">{u.internal_access ? "是" : "否"}</td>
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
        </CardContent>
      </Card>
    </div>
  );
}
