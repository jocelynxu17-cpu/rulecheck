import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInternalSecuritySnapshot } from "@/lib/admin/fetch-internal-security";
import { getInternalRuntimeStatus } from "@/lib/admin/internal-runtime-status";
import { InternalSystemEnvCard } from "@/components/admin/InternalSystemEnvCard";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { InternalOpsAuditSection } from "@/components/admin/InternalOpsAuditSection";

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

export default async function InternalSecurityPage() {
  const snap = await fetchInternalSecuritySnapshot();
  const runtime = getInternalRuntimeStatus();

  return (
    <div className="space-y-10 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink">安全</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          內部權限門檻、敏感帳務與稽核摘要；細部仍須搭配主機／雲平台 log 與金流後台。
        </p>
      </div>

      {snap.errorMessage ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">{snap.errorMessage}</p>
      ) : null}

      <InternalSystemEnvCard runtime={runtime} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">內部存取門檻</CardTitle>
            <CardDescription>SUPERADMIN_EMAILS 與 ADMIN_EMAILS（不顯示實際信箱）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-secondary">
            <p>
              <span className="font-medium text-ink">SUPERADMIN</span> 設定筆數：{snap.superadminEmailCount}
            </p>
            <p>
              <span className="font-medium text-ink">ADMIN</span> 設定筆數：{snap.adminEmailCount}
            </p>
            {snap.internalUsesAdminFallback ? (
              <p className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
                目前未設定 SUPERADMIN_EMAILS，內部營運與 <code className="font-mono">/api/admin/*</code>{" "}
                過渡為 ADMIN_EMAILS 門檻。正式環境建議改為僅 SUPERADMIN。
              </p>
            ) : (
              <p className="text-xs">內部路由與營運 API 以 SUPERADMIN 名單為準。</p>
            )}
            <p className="text-xs">
              使用者端不顯示內部連結；middleware 阻擋非授權者進入{" "}
              <code className="rounded bg-canvas px-1 font-mono text-[11px]">/internal</code>。
            </p>
          </CardContent>
        </Card>

        <Card className="border-surface-border">
          <CardHeader>
            <CardTitle className="text-base">高風險帳務事件（近 7 日）</CardTitle>
            <CardDescription>掃描最近 300 筆 payment_events，事件類型符合失敗／風險規則者</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-medium tabular-nums text-ink">{snap.highRiskPaymentEventCount7d}</p>
            <p className="mt-2 text-xs text-ink-secondary">
              詳列請至{" "}
              <Link href="/internal/analysis" className="font-medium text-ink underline-offset-4 hover:underline">
                分析營運
              </Link>
              。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-surface-border">
        <CardHeader>
          <CardTitle className="text-base">近期敏感帳務操作（notify／帳務狀態）</CardTitle>
          <CardDescription>
            自最近 300 筆事件中擷取含 notify 或 payload 帶 billing_state 者（最多 15 筆）。不含未寫入 DB 之 API 動作。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snap.recentSensitivePaymentEvents.length === 0 ? (
            <p className="text-sm text-ink-secondary">尚無符合事件。</p>
          ) : (
            <ul className="divide-y divide-surface-border/80 rounded-xl border border-surface-border bg-white">
              {snap.recentSensitivePaymentEvents.map((ev) => (
                <li key={ev.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                    <PaymentEventTypeBadge eventType={ev.event_type} />
                    <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                  </div>
                  <p className="text-xs text-ink-secondary">{ev.user_email ?? ev.user_id ?? "—"}</p>
                  <p className="text-[11px] leading-snug text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
                  <p className="font-mono text-[10px] text-ink-secondary/80">{ev.id}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InternalOpsAuditSection
        rows={snap.recentInternalOpsAudit}
        title="內部營運稽核軌跡"
        description="修復、營運 PATCH（額度／方案／訂閱狀態）、帳務 Notify 等；寫入 internal_ops_audit_log（service role）。"
        moreHref="/internal/audit"
        moreLabel="完整列表與篩選"
      />

      <Card className="border-surface-border bg-canvas/30">
        <CardHeader>
          <CardTitle className="text-base">其他營運 API</CardTitle>
          <CardDescription>未列入上表之端點仍建議搭配雲端／主機 log</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-ink-secondary">
          <p>
            <code className="rounded bg-canvas px-1 font-mono text-xs">/api/admin/workspaces/*</code> 已涵蓋之動作會寫入稽核表；其餘路由請於外部變更管理或基礎設施稽核留存。
          </p>
          <p className="mt-2">
            工作區修復入口：{" "}
            <Link href="/internal" className="font-medium text-ink underline-offset-4 hover:underline">
              總覽
            </Link>
            。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
