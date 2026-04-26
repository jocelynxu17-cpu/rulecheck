import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InternalRuntimeStatus } from "@/lib/admin/internal-runtime-status";

function envFlag(ok: boolean): string {
  return ok ? "已設定" : "未設定";
}

export function InternalSystemEnvCard({
  runtime,
  showSettingsLink = true,
}: {
  runtime: InternalRuntimeStatus;
  showSettingsLink?: boolean;
}) {
  return (
    <Card className="border-surface-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">系統與 Provider 狀態</CardTitle>
            <CardDescription>僅顯示有／無，不暴露金鑰或 secret。</CardDescription>
          </div>
          {showSettingsLink ? (
            <Link
              href="/internal/settings"
              className="shrink-0 text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
            >
              完整設定摘要
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-ink-secondary">
        <p>
          <span className="font-medium text-ink">NODE_ENV</span>{" "}
          <code className="rounded bg-canvas px-1 font-mono text-xs">{runtime.nodeEnv}</code>
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>公開 Supabase URL：{envFlag(runtime.hasPublicSupabaseUrl)}</li>
          <li>Anon Key：{envFlag(runtime.hasAnonKey)}</li>
          <li>Service Role：{envFlag(runtime.hasServiceRoleKey)}</li>
          <li>Stripe Secret：{envFlag(runtime.stripeSecretConfigured)}</li>
          <li>Stripe Webhook Secret：{envFlag(runtime.stripeWebhookConfigured)}</li>
          <li>OpenAI API Key：{envFlag(runtime.openaiApiKeyPresent)}</li>
          <li>OpenAI 模型變數：{envFlag(runtime.openaiModelConfigured)}</li>
        </ul>
        <p className="text-xs">
          SUPERADMIN 名單筆數：{runtime.superadminEmailCount}；ADMIN 名單筆數：{runtime.adminEmailCount}
          {runtime.internalUsesAdminFallback ? (
            <span className="ml-1 text-amber-900">（內部路由目前過渡為 ADMIN 門檻）</span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
