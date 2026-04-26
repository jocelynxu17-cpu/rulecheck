import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPaymentEvents, loadPaymentEventsForWorkspace } from "@/lib/admin/load-payment-events";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";

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

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentEventsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const rawWs = sp.workspace;
  const workspaceParam = typeof rawWs === "string" ? rawWs : Array.isArray(rawWs) ? rawWs[0] : undefined;
  const workspaceId = workspaceParam && UUID_RE.test(workspaceParam) ? workspaceParam : null;

  const { rows, error } = workspaceId
    ? await loadPaymentEventsForWorkspace(workspaceId, 500)
    : await loadPaymentEvents(250);

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
              或成員 user_id 篩選。
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

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">事件列表</CardTitle>
          <CardDescription>
            {workspaceId ? "依工作區篩選 · 至多掃描 500 筆全域事件" : "最新 250 筆"} · 台北時間顯示
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-amber-900">{error}</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border bg-canvas/25 px-5 py-12 text-center">
              <p className="text-sm font-medium text-ink">{workspaceId ? "此工作區尚無關聯事件" : "尚無紀錄"}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
                {workspaceId
                  ? "可能尚未寫入 workspace_id、或成員未觸發相關 Webhook。可改看未篩選之全站列表或工作區營運頁之異常區塊。"
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
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                        {formatDateTime(r.created_at)}
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
    </div>
  );
}
