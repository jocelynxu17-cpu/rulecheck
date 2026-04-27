import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPaymentEvents, loadPaymentEventsForWorkspace } from "@/lib/admin/load-payment-events";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import {
  INTERNAL_PAYMENT_BATCH_SCAN_MAX,
  INTERNAL_PAYMENT_PAGE_DEFAULT,
  INTERNAL_PAYMENT_PAGE_MAX,
  clampPage,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";
import { flattenInternalSearchParams, hrefWithPage } from "@/lib/admin/internal-pagination-url";
import { InternalOpsListGuideCard } from "@/components/admin/InternalOpsListGuideCard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentEventsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const flat = flattenInternalSearchParams(sp);
  const rawWs = flat.workspace;
  const workspaceId = rawWs && UUID_RE.test(rawWs) ? rawWs : null;

  const page = clampPage(parsePositiveInt(flat.page, 1));
  const pageSize = clampPageSize(
    parsePositiveInt(flat.page_size, INTERNAL_PAYMENT_PAGE_DEFAULT),
    INTERNAL_PAYMENT_PAGE_DEFAULT,
    INTERNAL_PAYMENT_PAGE_MAX
  );
  const offset = (page - 1) * pageSize;

  const { rows, error, hasNextPage } = workspaceId
    ? await loadPaymentEventsForWorkspace(workspaceId, { offset, pageSize })
    : await loadPaymentEvents({ limit: pageSize, offset });

  const prevHref =
    page > 1
      ? hrefWithPage("/internal/payment-events", flat, { page: String(page - 1) })
      : null;
  const nextHref = hasNextPage ? hrefWithPage("/internal/payment-events", flat, { page: String(page + 1) }) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">帳務</h1>
          {workspaceId ? (
            <span className="rounded-md border border-surface-border bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              工作區篩選
            </span>
          ) : null}
        </div>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          帳務與方案營運中心：Webhook 與金流寫入之{" "}
          <code className="rounded bg-canvas px-1 font-mono text-xs">payment_events</code>
          （含 idempotency 去重）。以工作區為核心對帳；摘要為精簡後 payload。
          {workspaceId ? (
            <>
              {" "}
              目前依 payload 之 <code className="rounded bg-canvas px-1 font-mono text-xs">workspace_id</code>{" "}
              或成員 user_id 篩選；列表僅在目前掃描視窗內分頁。
              <Link href="/internal/payment-events" className="ml-2 font-medium text-ink underline-offset-4 hover:underline">
                清除篩選
              </Link>
            </>
          ) : null}
        </p>
        {workspaceId ? (
          <p className="font-mono text-xs text-ink-secondary">
            workspace_id = {workspaceId}
            <Link
              href={`/internal/workspaces/${workspaceId}`}
              className="ml-3 font-sans text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              返回工作區營運頁
            </Link>
          </p>
        ) : null}
      </div>

      <InternalOpsListGuideCard
        summary="原始帳務事件列表：全域列表用 DB 分頁；工作區篩選為先取固定視窗再過濾後分頁。"
        bullets={[
          "預設每頁筆數見下方；可用 URL `page`、`page_size` 調整（上限依程式約束）。",
          "需要與分析區間交叉時請用「分析營運」摘要；此頁為事件真相來源而非摘要儀表板。",
        ]}
      />

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">事件列表</CardTitle>
          <CardDescription>
            {workspaceId
              ? `依工作區 · 先掃描至多 ${INTERNAL_PAYMENT_BATCH_SCAN_MAX} 筆全域事件再篩選 · 第 ${page} 頁 · 每頁 ${pageSize} 筆`
              : `第 ${page} 頁 · 每頁 ${pageSize} 筆（預設 ${INTERNAL_PAYMENT_PAGE_DEFAULT}）`}
            · 台北時間顯示
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-amber-900">{error}</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border bg-canvas/25 px-5 py-12 text-center">
              <p className="text-sm font-medium text-ink">{workspaceId ? "此條件下無更多列" : "尚無紀錄"}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
                {workspaceId
                  ? "可能尚未寫入 workspace_id、或已超過目前掃描視窗；可改未篩選列表或調整頁碼。"
                  : "尚無寫入之帳務事件。"}
              </p>
              {workspaceId ? (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/internal/payment-events"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-5 text-sm font-medium text-ink transition hover:bg-zinc-50"
                  >
                    清除篩選
                  </Link>
                  <Link
                    href={`/internal/workspaces/${workspaceId}`}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-5 text-sm font-medium text-ink transition hover:bg-zinc-50"
                  >
                    工作區營運
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
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
                    {rows.map((r) => (
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
                        <td className="max-w-md px-4 py-3 text-[11px] leading-snug text-ink-secondary">{summarizePaymentPayload(r.payload)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-secondary">
                <span className="text-xs">
                  第 {page} 頁 · 每頁 {pageSize} 筆{hasNextPage ? " · 尚有下一頁" : ""}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
