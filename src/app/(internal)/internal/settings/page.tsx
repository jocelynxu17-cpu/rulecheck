import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInternalRuntimeStatus } from "@/lib/admin/internal-runtime-status";
import { InternalSystemEnvCard } from "@/components/admin/InternalSystemEnvCard";
import { IMAGE_MAX_BYTES, PDF_MAX_BYTES, PDF_MAX_PAGES } from "@/lib/analyze/input-limits";

export default function InternalSettingsPage() {
  const runtime = getInternalRuntimeStatus();

  return (
    <div className="space-y-10 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">設定</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          系統層摘要：部署變數是否就緒、關鍵上限與對外 Provider。不含 secret 內容。
        </p>
      </div>

      <InternalSystemEnvCard runtime={runtime} showSettingsLink={false} />

      <Card className="border-surface-border border-dashed">
        <CardHeader>
          <CardTitle className="text-base">內部後台 · 擴展性約定</CardTitle>
          <CardDescription>列表頁預設分頁載入；摘要與抽樣會標示；細節在明細頁。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-ink-secondary">
          <p>
            主要規則：摘要優先、明細在專頁；使用者／工作區／帳務／稽核列表皆有分頁與篩選入口；總覽不重複塞入長事件流。
          </p>
          <p>
            數值來源：`users`／`workspaces` 等計數為 exact head count（仍應視為後台維護操作）；營運列表上的「最近活動」等多為批次抽樣。
          </p>
          <p className="text-xs">
            預設頁長等常數集中於程式碼{" "}
            <code className="rounded bg-canvas px-1 font-mono text-[11px]">internal-scale-conventions</code>。
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">產品限制（與 API 一致）</CardTitle>
            <CardDescription>供營運對照客訴與上傳失敗原因</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-secondary">
            <p>
              圖片上傳上限：<span className="font-mono text-ink">{IMAGE_MAX_BYTES / (1024 * 1024)}</span> MB
            </p>
            <p>
              PDF 上傳上限：<span className="font-mono text-ink">{PDF_MAX_BYTES / (1024 * 1024)}</span> MB · 最多{" "}
              <span className="font-mono text-ink">{PDF_MAX_PAGES}</span> 頁（分析扣點）
            </p>
          </CardContent>
        </Card>

        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">Feature flags</CardTitle>
            <CardDescription>目前程式未集中管理 feature flag 表；若後續導入可在此摘要。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-ink-secondary">
            <p>無額外旗標檔時，請以環境變數與資料庫欄位為準。</p>
            <p className="mt-3">
              相關營運頁：{" "}
              <Link href="/internal/security" className="font-medium text-ink underline-offset-4 hover:underline">
                安全
              </Link>
              、{" "}
              <Link href="/internal/analysis" className="font-medium text-ink underline-offset-4 hover:underline">
                分析營運
              </Link>
              。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
