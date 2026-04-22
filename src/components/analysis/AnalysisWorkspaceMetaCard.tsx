import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisMeta } from "@/types/analysis";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";

/** 顯示單次分析結果中與工作區 SSOT 對齊之 meta（新紀錄才有完整欄位）。 */
export function AnalysisWorkspaceMetaCard({ meta }: { meta: AnalysisMeta }) {
  if (meta.guest) {
    return null;
  }

  const hasAny =
    meta.workspaceName ||
    meta.workspaceId ||
    meta.plan != null ||
    meta.workspaceMonthlyQuotaUnits != null ||
    meta.workspaceSubscriptionStatus != null ||
    meta.workspaceBillingProvider != null ||
    meta.quotaRemaining != null;

  if (!hasAny) {
    return null;
  }

  return (
    <Card className="border-surface-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">工作區與配額（此筆分析）</CardTitle>
        <CardDescription>與帳務頁、儀表板相同之工作區來源；數值取自分析當下 API 寫入之 meta。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        {meta.workspaceName ? (
          <div>
            <p className="text-xs font-medium text-ink-secondary">工作區</p>
            <p className="mt-0.5 font-medium text-ink">{meta.workspaceName}</p>
          </div>
        ) : null}
        {meta.workspaceId ? (
          <div>
            <p className="text-xs font-medium text-ink-secondary">工作區 ID</p>
            <p className="mt-0.5 font-mono text-xs text-ink-secondary">{meta.workspaceId}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-ink-secondary">方案</p>
          <p className="mt-0.5 text-ink">{meta.plan ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">訂閱狀態</p>
          <p className="mt-0.5 text-ink-secondary">
            {subscriptionStatusLabelZh(meta.workspaceSubscriptionStatus ?? null)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">帳務來源</p>
          <p className="mt-0.5 text-ink-secondary">
            {billingProviderLabelZh(meta.workspaceBillingProvider ?? null) ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">月度共用額度上限</p>
          <p className="mt-0.5 tabular-nums text-ink">
            {meta.workspaceMonthlyQuotaUnits != null ? meta.workspaceMonthlyQuotaUnits : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">扣點後剩餘額度</p>
          <p className="mt-0.5 tabular-nums text-ink">
            {meta.quotaRemaining != null ? meta.quotaRemaining : "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
