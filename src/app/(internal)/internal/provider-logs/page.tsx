import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function AdminProviderLogsPage() {
  const { rows, error } = await loadPaymentEvents(400);
  const flagged = rows.filter((r) => isLikelyPaymentFailureEventType(r.event_type));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">管理</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">供應商紀錄</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          目前產品資料庫未建置獨立「API / LLM 錯誤表」。此頁匯集帳務事件中
          <span className="font-medium text-ink">可能異常</span>
          之類型（關鍵字：failed、error、declined 等），供與 Stripe／部署平台日誌交叉比對。
        </p>
      </div>

      <Card className="border-surface-border bg-white/60">
        <CardHeader>
          <CardTitle className="text-base">除錯建議</CardTitle>
          <CardDescription>高訊號營運路徑</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-secondary">
          <p>· Stripe：儀表板 Webhook 傳遞紀錄與事件詳情。</p>
          <p>· 應用：Vercel／主機 stdout（例如 webhook handler 內 <code className="font-mono text-xs">console.error</code>）。</p>
          <p>· 若需長期稽核 LLM 供應商錯誤，建議另建寫入表或由可觀測性平台承接。</p>
        </CardContent>
      </Card>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">帳務層級可疑事件</CardTitle>
          <CardDescription>
            自最近 {rows.length} 筆帳務事件中篩出 {flagged.length} 筆（規則同總覽）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-amber-900">{error}</p>
          ) : flagged.length === 0 ? (
            <p className="text-sm text-ink-secondary">目前無符合篩選條件之事件。</p>
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
    </div>
  );
}
