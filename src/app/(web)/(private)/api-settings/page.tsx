import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** 使用者可見之 API／整合設定預留頁（無供應商內部細節）。 */
export default function ApiSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">設定</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink">API 與整合</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          若產品方向包含對外 API、Webhook 或金鑰管理，將於此集中設定。目前為預留頁面。
        </p>
      </div>
      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">即將推出</CardTitle>
          <CardDescription>不會在此顯示供應商內部參數或除錯資訊。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-ink-secondary">敬請期待後續版本。</CardContent>
      </Card>
    </div>
  );
}
